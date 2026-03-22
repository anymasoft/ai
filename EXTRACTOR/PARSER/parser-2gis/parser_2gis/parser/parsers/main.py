from __future__ import annotations

import base64
import json
import re
import time
import urllib.parse
from typing import TYPE_CHECKING, Optional

from ...chrome import ChromeRemote
from ...common import wait_until_finished
from ...logger import logger
from ..utils import blocked_requests

if TYPE_CHECKING:
    from ...chrome import ChromeOptions
    from ...chrome.dom import DOMNode
    from ...writer import FileWriter
    from ..options import ParserOptions


class MainParser:
    """Main parser that extracts useful payload
    from search result pages using Chrome browser
    and saves it into a `csv`, `xlsx` or `json` files.

    Args:
        url: 2GIS URLs with items to be collected.
        chrome_options: Chrome options.
        parser_options: Parser options.
    """
    def __init__(self, url: str,
                 chrome_options: ChromeOptions,
                 parser_options: ParserOptions) -> None:
        self._options = parser_options
        self._url = url

        # "Catalog Item Document" response pattern.
        self._item_response_pattern = r'https://catalog\.api\.2gis.[^/]+/.*/items/byid'

        # Open browser, start remote
        response_patterns = [self._item_response_pattern]
        self._chrome_remote = ChromeRemote(chrome_options=chrome_options,
                                           response_patterns=response_patterns)
        self._chrome_remote.start()

        # Add counter for 2GIS requsts
        self._add_xhr_counter()

        # Disable specific requests
        blocked_urls = blocked_requests(extended=chrome_options.disable_images)
        self._chrome_remote.add_blocked_requests(blocked_urls)

    @staticmethod
    def url_pattern():
        """URL pattern for the parser."""
        return r'https?://2gis\.[^/]+/[^/]+/search/.*'

    @wait_until_finished(timeout=5, throw_exception=False)
    def _get_links(self) -> list[DOMNode]:
        """Extracts specific DOM node links from current DOM snapshot."""
        def valid_link(node: DOMNode) -> bool:
            if node.local_name == 'a' and 'href' in node.attributes:
                link_match = re.match(r'.*/(firm|station)/.*\?stat=(?P<data>[a-zA-Z0-9%]+)', node.attributes['href'])
                if link_match:
                    try:
                        base64.b64decode(urllib.parse.unquote(link_match.group('data')))
                        return True
                    except:
                        pass

            return False

        dom_tree = self._chrome_remote.get_document()
        return dom_tree.search(valid_link)

    def _add_xhr_counter(self) -> None:
        """Inject old-school wrapper around XMLHttpRequest,
        to keep track of all pending requests to 2GIS website."""
        xhr_script = r'''
            (function() {
                var oldOpen = XMLHttpRequest.prototype.open;
                XMLHttpRequest.prototype.open = function(method, url, async, user, pass) {
                    if (url.match(/^https?\:\/\/[^\/]*2gis\.[a-z]+/i)) {
                        if (window.openHTTPs == undefined) {
                            window.openHTTPs = 1;
                        } else {
                            window.openHTTPs++;
                        }
                        this.addEventListener("readystatechange", function() {
                            if (this.readyState == 4) {
                                window.openHTTPs--;
                            }
                        }, false);
                    }
                    oldOpen.call(this, method, url, async, user, pass);
                }
            })();
        '''
        self._chrome_remote.add_start_script(xhr_script)

    def _find_node_by_href(self, target_href: str) -> Optional[DOMNode]:
        """Find a fresh DOMNode by href from current DOM snapshot.

        Args:
            target_href: Target href to find.

        Returns:
            Fresh DOMNode or None if not found.
        """
        links = self._get_links()
        if not links:
            return None
        for link in links:
            if link.attributes.get('href') == target_href:
                return link
        return None

    def _safe_click_and_wait(self, target_href: str, max_attempts: int = 3) -> Optional[dict]:
        """Find element by href in fresh DOM, click it, wait for response.

        Args:
            target_href: Target href to click.
            max_attempts: Max retry attempts.

        Returns:
            Response dict or None.
        """
        for attempt in range(1, max_attempts + 1):
            # Каждая попытка — свежий DOM
            node = self._find_node_by_href(target_href)
            if not node:
                logger.warning('Элемент с href не найден в DOM (попытка %d/%d): %s',
                               attempt, max_attempts, target_href[:80])
                time.sleep(0.5)
                continue

            clicked = self._chrome_remote.perform_click(node)
            if not clicked:
                logger.debug('Клик не удался (попытка %d/%d), переполучаю DOM...', attempt, max_attempts)
                time.sleep(0.3)
                continue

            # Задержка между кликами
            if self._options.delay_between_clicks:
                self._chrome_remote.wait(self._options.delay_between_clicks / 1000)

            # Ждём response
            resp = self._chrome_remote.wait_response(self._item_response_pattern)
            if resp and resp.get('status', -1) >= 0:
                return resp

            logger.debug('Нет ответа после клика (попытка %d/%d)', attempt, max_attempts)
            time.sleep(0.5)

        return None

    @wait_until_finished(timeout=120)
    def _wait_requests_finished(self) -> bool:
        """Wait for all pending requests."""
        return self._chrome_remote.execute_script('window.openHTTPs == 0')

    def _get_available_pages(self) -> dict[int, DOMNode]:
        """Get available pages to navigate."""
        dom_tree = self._chrome_remote.get_document()
        dom_links = dom_tree.search(lambda x: x.local_name == 'a' and 'href' in x.attributes)

        available_pages = {}
        for link in dom_links:
            link_match = re.match(r'.*/search/.*/page/(?P<page_number>\d+)', link.attributes['href'])
            if link_match:
                available_pages[int(link_match.group('page_number'))] = link

        return available_pages

    def _go_page(self, n_page: int) -> Optional[int]:
        """Go page with number `n_page`.

        Note:
            `n_page` gotta exists in current DOM.
            Otherwise 2GIS anti-bot will redirect you to the first page.

        Args:
            n_page: Page number.

        Returns:
            Navigated page number.
        """
        available_pages = self._get_available_pages()
        if n_page in available_pages:
            clicked = self._chrome_remote.perform_click(available_pages[n_page])
            if not clicked:
                # Stale node — re-fetch pages and retry once
                available_pages = self._get_available_pages()
                if n_page in available_pages:
                    clicked = self._chrome_remote.perform_click(available_pages[n_page])
            if clicked:
                return n_page

        return None

    def parse(self, writer: FileWriter) -> None:
        """Parse URL with result items.

        Args:
            writer: Target file writer.
        """
        # Starting from page 6 and further
        # 2GIS redirects user to the beginning automatically (anti-bot protection).
        # If a page argument found in the URL, we should manually walk to it first.

        current_page_number = 1
        url = re.sub(r'/page/\d+', '', self._url, re.I)

        page_match = re.search(r'/page/(?P<page_number>\d+)', self._url, re.I)
        if page_match:
            walk_page_number = int(page_match.group('page_number'))
        else:
            walk_page_number = None

        # Go URL
        self._chrome_remote.navigate(url, referer='https://google.com', timeout=120)

        # Document loaded, get its response
        responses = self._chrome_remote.get_responses(timeout=5)
        if not responses:
            logger.error('Ошибка получения ответа сервера.')
            return
        document_response = responses[0]

        # Handle unexpected MIME type
        if document_response.get('mimeType') != 'text/html':
            logger.error('Неожиданный MIME-тип ответа: %s, ожидался text/html.', document_response.get('mimeType'))
            return

        if document_response['status'] == 404:
            logger.warn('Сервер вернул сообщение "Точных совпадений нет / Не найдено".')

            if self._options.skip_404_response:
                return

        # Parsed records
        collected_records = 0

        # Already visited hrefs (NOT DOMNode objects — they go stale)
        visited_hrefs: set[str] = set()

        @wait_until_finished(timeout=10, throw_exception=False)
        def get_unique_hrefs() -> list[str]:
            """Get hrefs from current DOM that haven't been visited yet."""
            links = self._get_links()
            if not links:
                return []
            hrefs = []
            for link in links:
                href = link.attributes.get('href', '')
                if href and href not in visited_hrefs:
                    hrefs.append(href)
            if not hrefs:
                return []
            visited_hrefs.update(hrefs)
            return hrefs

        while True:
            # Wait all 2GIS requests get finished
            self._wait_requests_finished()

            # Gather hrefs (strings, not DOM nodes)
            target_hrefs = get_unique_hrefs()

            # We should parse the page if we are not walking
            if not walk_page_number:
                # Iterate through gathered hrefs
                for link_index, target_href in enumerate(target_hrefs, 1):
                    # Click with fresh DOM lookup each time
                    resp = self._safe_click_and_wait(target_href)

                    # Get response body data
                    if resp:
                        data = self._chrome_remote.get_response_body(resp, timeout=10)

                        try:
                            doc = json.loads(data)
                        except json.JSONDecodeError:
                            logger.error('[Компания %d] Некорректный JSON: "%s", пропуск.',
                                         link_index, data[:100] if data else '')
                            doc = None
                    else:
                        logger.warning('[Компания %d] Не удалось получить ответ, пропуск.', link_index)
                        doc = None

                    if doc:
                        # Write API document into a file
                        writer.write(doc)
                        collected_records += 1
                        logger.info('[Компания %d] Запись сохранена. Всего: %d', link_index, collected_records)
                    else:
                        logger.error('[Компания %d] Данные не получены, пропуск позиции.', link_index)

                    # We've reached our limit, bail
                    if collected_records >= self._options.max_records:
                        logger.info('Спарсено максимально разрешенное количество записей с данного URL.')
                        return

            # Evaluate Garbage Collection if it's been exposed and enabled
            if self._options.use_gc and current_page_number % self._options.gc_pages_interval == 0:
                logger.debug('Запуск сборщика мусора.')
                self._chrome_remote.execute_script('"gc" in window && window.gc()')

            # Free memory allocated for collected requests
            self._chrome_remote.clear_requests()

            # Calculate next page number and navigate it
            if walk_page_number:
                available_pages = self._get_available_pages()
                available_pages_ahead = {k: v for k, v in available_pages.items()
                                         if k > current_page_number}
                next_page_number = min(available_pages_ahead, key=lambda n: abs(n - walk_page_number),  # type: ignore
                                       default=current_page_number + 1)
            else:
                next_page_number = current_page_number + 1

            current_page_number = self._go_page(next_page_number)  # type: ignore
            if not current_page_number:
                break  # Reached the end of the search results

            # Unset walking page if we've done walking to the desired page
            if walk_page_number and walk_page_number <= current_page_number:
                walk_page_number = None

    def close(self) -> None:
        self._chrome_remote.stop()

    def __enter__(self) -> MainParser:
        return self

    def __exit__(self, *exc_info) -> None:
        self.close()

    def __repr__(self) -> str:
        classname = self.__class__.__name__
        return (f'{classname}(parser_options={self._options!r}, '
                'chrome_remote={self._chrome_remote!r}, '
                'url={self._url!r}')
