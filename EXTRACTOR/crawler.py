#!/usr/bin/env python3
"""
LeadExtractor Crawler — Stage 1: Link Discovery
Скачивает страницы и извлекает все внутренние ссылки.
"""

import sys
import re
from pathlib import Path
from urllib.parse import urljoin, urlparse
from typing import Set, List

from bs4 import BeautifulSoup

try:
    from crawl4ai import AsyncWebCrawler
    HAS_CRAWL4AI = True
except ImportError:
    HAS_CRAWL4AI = False

# ---------------------------------------------------------------------------
# Конфигурация
# ---------------------------------------------------------------------------

URLS_FILE = Path(__file__).parent / "urls.txt"


# ---------------------------------------------------------------------------
# Функции
# ---------------------------------------------------------------------------

def read_urls(filepath: Path) -> List[str]:
    """Читает URL из файла (по одному на строку)."""
    if not filepath.exists():
        print(f"⚠️  Файл не найден: {filepath}")
        return []

    with open(filepath, "r", encoding="utf-8") as f:
        urls = [line.strip() for line in f if line.strip() and not line.startswith("#")]

    return urls


def get_domain(url: str) -> str:
    """Извлекает домен из URL."""
    parsed = urlparse(url)
    return f"{parsed.scheme}://{parsed.netloc}"


def is_same_domain(url: str, base_url: str) -> bool:
    """Проверяет, принадлежит ли URL тому же домену."""
    return get_domain(url) == get_domain(base_url)


def normalize_url(url: str, base_url: str) -> str | None:
    """
    Нормализует относительную ссылку в абсолютную.
    Удаляет якоря и query-параметры.
    """
    if not url or url.startswith(("mailto:", "tel:", "javascript:")):
        return None

    # Преобразуем в абсолютную ссылку
    absolute_url = urljoin(base_url, url)

    # Удаляем якоря (#...)
    absolute_url = absolute_url.split("#")[0]

    # Удаляем query-параметры (?...)
    absolute_url = absolute_url.split("?")[0]

    # Проверяем на самодомен
    if not is_same_domain(absolute_url, base_url):
        return None

    # Исключаем пустые ссылки
    if not absolute_url or absolute_url == base_url + "/":
        return None

    return absolute_url


def extract_links_from_html(html: str, base_url: str) -> Set[str]:
    """Извлекает все ссылки из HTML: <a>, <link>, <script>."""
    links = set()

    try:
        soup = BeautifulSoup(html, "html.parser")

        # <a href="">
        for tag in soup.find_all("a", href=True):
            url = normalize_url(tag["href"], base_url)
            if url:
                links.add(url)

        # <link href="">
        for tag in soup.find_all("link", href=True):
            url = normalize_url(tag["href"], base_url)
            if url:
                links.add(url)

        # <script src="">
        for tag in soup.find_all("script", src=True):
            url = normalize_url(tag["src"], base_url)
            if url:
                links.add(url)

    except Exception as e:
        print(f"⚠️  Ошибка парсинга HTML: {e}")

    return links


async def fetch_page_crawl4ai(url: str) -> str | None:
    """Скачивает страницу через crawl4ai."""
    try:
        async with AsyncWebCrawler() as crawler:
            result = await crawler.arun(url)
            return result.html if result.html else None
    except Exception as e:
        print(f"⚠️  Ошибка crawl4ai для {url}: {e}")
        return None


def fetch_page_fallback(url: str) -> str | None:
    """Fallback: скачивание через urllib."""
    try:
        import urllib.request
        import urllib.error

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as response:
            return response.read().decode("utf-8", errors="ignore")
    except Exception as e:
        print(f"⚠️  Ошибка urllib для {url}: {e}")
        return None


async def fetch_page(url: str) -> str | None:
    """Скачивает страницу (crawl4ai или fallback)."""
    if HAS_CRAWL4AI:
        html = await fetch_page_crawl4ai(url)
        if html:
            return html

    return fetch_page_fallback(url)


def process_url(url: str) -> tuple[str, Set[str]]:
    """Обрабатывает один URL и возвращает найденные ссылки."""
    import asyncio

    print(f"🔄 Обработка: {url}")

    html = asyncio.run(fetch_page(url))
    if not html:
        print(f"❌ Не удалось скачать: {url}\n")
        return url, set()

    links = extract_links_from_html(html, url)
    return url, links


def print_results(url: str, links: Set[str]):
    """Выводит результаты в консоль."""
    print("-" * 75)
    print(f"URL: {url}")
    print(f"FOUND LINKS: ({len(links)} уникальных)")
    if links:
        for link in sorted(links):
            print(f"  {link}")
    else:
        print("  (не найдено)")
    print("-" * 75)
    print()


def main():
    """Главная функция."""
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    else:
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

    urls = read_urls(URLS_FILE)
    if not urls:
        print(f"❌ Нет URL в файле {URLS_FILE}")
        print("\nПримечание: создайте файл urls.txt со списком URL-адресов")
        print("Формат: одна ссылка на строку")
        return

    print(f"📂 Загружено {len(urls)} URL(ов) из {URLS_FILE}\n")

    total_links = 0
    for url in urls:
        try:
            url = url.strip()
            if not url or url.startswith("#"):
                continue

            processed_url, links = process_url(url)
            print_results(processed_url, links)
            total_links += len(links)

        except KeyboardInterrupt:
            print("\n⏹️  Прервано пользователем")
            break
        except Exception as e:
            print(f"❌ Ошибка обработки {url}: {e}\n")

    print(f"\n📊 Итого: найдено {total_links} уникальных ссылок")


if __name__ == "__main__":
    main()
