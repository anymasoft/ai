# url_handler.py

import requests
import logging
from typing import Tuple, Optional
from urllib.parse import urljoin, urlparse
import time

logger = logging.getLogger(__name__)


class URLHandler:
    """
    Обработчик URL с поддержкой редиректов, 404, таймаутов.
    Гарантирует что мы не зависаем и правильно следуем редиректам.
    """

    DEFAULT_TIMEOUT = 5  # секунд
    MAX_REDIRECTS = 3
    RETRY_COUNT = 2
    RETRY_BACKOFF = [0.5, 1.0]  # секунды между повторами

    def __init__(self, timeout=DEFAULT_TIMEOUT):
        self.timeout = timeout
        self.session = requests.Session()
        # Отключаем встроенное следование редиректам, чтобы обработать самостоятельно
        self.session.max_redirects = 0

    def fetch_with_redirect_tracking(self, url: str) -> Tuple[Optional[str], Optional[int], str]:
        """
        Получает страницу, следует редиректам, обрабатывает ошибки.

        Args:
            url: URL для загрузки

        Returns:
            Tuple[html_content, final_status_code, final_url]
            - html_content: HTML страницы или None если ошибка
            - final_status_code: Финальный код статуса (200, 404, etc)
            - final_url: Финальный URL после всех редиректов

        Example:
            >>> handler = URLHandler()
            >>> html, code, final_url = handler.fetch_with_redirect_tracking(
            ...     "https://example.com/contact"
            ... )
            >>> if html:
            ...     print(f"Успешно загружено {final_url}")
            ... else:
            ...     print(f"Ошибка {code}")
        """

        current_url = url
        redirect_count = 0

        for attempt in range(self.RETRY_COUNT):
            try:
                logger.debug(f"Попытка {attempt + 1}: GET {current_url}")

                # Загружаем с таймаутом
                response = self.session.get(
                    current_url,
                    timeout=self.timeout,
                    allow_redirects=False,  # Обработаем редиректы сами
                    headers={
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                    }
                )

                # Следуем редиректам
                while response.status_code in (301, 302, 303, 307, 308):
                    if redirect_count >= self.MAX_REDIRECTS:
                        logger.warning(
                            f"Превышен лимит редиректов ({self.MAX_REDIRECTS}) для {url}"
                        )
                        break

                    # Получаем новый URL из Location header
                    location = response.headers.get("Location")
                    if not location:
                        logger.warning(f"Редирект без Location header: {current_url}")
                        break

                    # Обрабатываем относительные URL
                    if location.startswith("/"):
                        # Относительный путь - добавляем базовый домен
                        parsed = urlparse(current_url)
                        location = f"{parsed.scheme}://{parsed.netloc}{location}"

                    # Проверяем что редирект на тот же домен
                    old_parsed = urlparse(current_url)
                    new_parsed = urlparse(location)

                    if old_parsed.netloc != new_parsed.netloc:
                        logger.info(
                            f"Редирект на другой домен (отклоняем): "
                            f"{current_url} → {location}"
                        )
                        break

                    logger.debug(f"Следуем редиректу: {current_url} → {location}")
                    current_url = location
                    redirect_count += 1

                    # Загружаем следующий URL
                    response = self.session.get(
                        current_url,
                        timeout=self.timeout,
                        allow_redirects=False,
                        headers={
                            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                        }
                    )

                # Проверяем финальный статус
                if response.status_code == 200:
                    logger.info(f"✓ Успешно загружено: {current_url}")
                    return response.text, response.status_code, current_url

                elif response.status_code == 404:
                    logger.debug(f"✗ 404 Not Found: {current_url}")
                    return None, 404, current_url

                elif response.status_code in (403, 405, 410):
                    logger.debug(f"✗ Доступ запрещен ({response.status_code}): {current_url}")
                    return None, response.status_code, current_url

                elif response.status_code >= 500:
                    logger.warning(f"✗ Server error ({response.status_code}): {current_url}")
                    # Retry на server errors
                    if attempt < self.RETRY_COUNT - 1:
                        wait_time = self.RETRY_BACKOFF[attempt]
                        logger.debug(f"  Повторяем через {wait_time}с...")
                        time.sleep(wait_time)
                        continue
                    return None, response.status_code, current_url

                else:
                    logger.debug(f"✗ Неожиданный статус ({response.status_code}): {current_url}")
                    return None, response.status_code, current_url

            except requests.Timeout:
                logger.warning(f"✗ Timeout ({self.timeout}s): {current_url}")
                if attempt < self.RETRY_COUNT - 1:
                    wait_time = self.RETRY_BACKOFF[attempt]
                    logger.debug(f"  Повторяем через {wait_time}с...")
                    time.sleep(wait_time)
                    continue
                return None, None, current_url

            except requests.ConnectionError as e:
                logger.warning(f"✗ Connection error: {current_url} - {str(e)}")
                if attempt < self.RETRY_COUNT - 1:
                    wait_time = self.RETRY_BACKOFF[attempt]
                    logger.debug(f"  Повторяем через {wait_time}с...")
                    time.sleep(wait_time)
                    continue
                return None, None, current_url

            except Exception as e:
                logger.error(f"✗ Неожиданная ошибка при загрузке {current_url}: {str(e)}")
                return None, None, current_url

        # Если все попытки исчерпаны
        return None, None, current_url

    def get_base_url_from_redirects(self, domain: str) -> str:
        """
        Загружает главную страницу и извлекает базовый URL (учитывает редиректы).

        Полезно если /contact редиректит на /en/contact - мы обновляем базовый путь.

        Example:
            >>> handler = URLHandler()
            >>> base = handler.get_base_url_from_redirects("https://example.com")
            >>> # Если был редирект на /en, вернет https://example.com/en
        """
        html, status, final_url = self.fetch_with_redirect_tracking(domain)

        if status == 200:
            # Анализируем финальный URL
            parsed = urlparse(final_url)
            # Возвращаем домен + путь (если есть)
            base = f"{parsed.scheme}://{parsed.netloc}"

            if parsed.path and parsed.path != "/":
                logger.info(f"Обнаружен базовый путь в редиректе: {parsed.path}")
                return base + parsed.path.rstrip("/")

            return base

        return domain


# Тесты
if __name__ == "__main__":
    logging.basicConfig(level=logging.DEBUG)

    handler = URLHandler(timeout=5)

    # Тест 1: Успешная загрузка
    print("\n=== Тест 1: Нормальная загрузка ===")
    html, code, url = handler.fetch_with_redirect_tracking("https://example.com")
    print(f"Статус: {code}, URL: {url}, HTML длина: {len(html) if html else 0}")
