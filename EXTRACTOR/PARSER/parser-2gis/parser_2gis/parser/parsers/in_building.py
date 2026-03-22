from __future__ import annotations

import json
import re
from typing import TYPE_CHECKING

from ...common import wait_until_finished
from ...logger import logger
from .main import MainParser

if TYPE_CHECKING:
    from ...chrome.dom import DOMNode
    from ...writer import FileWriter


class InBuildingParser(MainParser):
    """Parser for the list of organizations provided by 2GIS with the tab "In building".

    URL pattern for such cases: https://2gis.<domain>/<city_id>/inside/<building_id>
    """

    @staticmethod
    def url_pattern():
        """URL pattern for the parser."""
        return r'https?://2gis\.[^/]+/[^/]+/inside/.*'

    @wait_until_finished(timeout=5, throw_exception=False)
    def _get_links(self) -> list[DOMNode]:
        """Extracts specific DOM node links from current DOM snapshot."""
        def valid_link(node: DOMNode) -> bool:
            if node.local_name == 'a' and 'href' in node.attributes:
                link_match = re.match(r'/[^/]+/firm/[^/]+$', node.attributes['href'])
                return bool(link_match)

            return False

        dom_tree = self._chrome_remote.get_document()
        return dom_tree.search(valid_link)

    def parse(self, writer: FileWriter) -> None:
        """Parse URL with organizations.

        Args:
            writer: Target file writer.
        """
        # Go URL
        self._chrome_remote.navigate(self._url, referer='https://google.com', timeout=120)

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

        # Get new hrefs from current DOM
        @wait_until_finished(timeout=5, throw_exception=False)
        def get_unique_hrefs() -> list[str]:
            links = self._get_links()
            if not links:
                return []
            new_hrefs = []
            for link in links:
                href = link.attributes.get('href', '')
                if href and href not in visited_hrefs:
                    new_hrefs.append(href)
            visited_hrefs.update(new_hrefs)
            return new_hrefs

        # Loop down through lazy load organizations list
        while True:
            # Wait all 2GIS requests get finished
            self._wait_requests_finished()

            # Gather hrefs (strings, not DOM nodes)
            target_hrefs = get_unique_hrefs()
            if not target_hrefs:
                break

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
                else:
                    logger.error('[Компания %d] Данные не получены, пропуск позиции.', link_index)

                # We've reached our limit, bail
                if collected_records >= self._options.max_records:
                    logger.info('Спарсено максимально разрешенное количество записей с данного URL.')
                    return
