#!/usr/bin/env python3
"""
search_duckduckgo.py — поиск сайтов компаний по текстовому запросу через DuckDuckGo.
Без API, только HTML парсинг.
"""

import sys
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse, urljoin, quote, unquote, parse_qs
from typing import List, Set, Tuple

# ============================================================================
# Конфигурация
# ============================================================================

# Чёрный список доменов (платформы, агрегаторы, социальные сети)
EXCLUDED_DOMAINS = {
    # Видео
    "youtube.com", "youtu.be",
    # Карты
    "yandex.ru", "maps.yandex.ru",
    "google.com", "maps.google.com", "google.ru",
    "2gis.ru",
    # Соцсети
    "vk.com", "vkontakte.ru",
    "facebook.com", "fb.com",
    "instagram.com",
    "twitter.com", "x.com",
    "linkedin.com",
    "reddit.com",
    # Маркетплейсы
    "avito.ru",
    "ozon.ru",
    "wildberries.ru",
    "aliexpress.ru",
    "ebay.com",
    # Энциклопедии
    "wikipedia.org",
    "wiki.org",
    # DuckDuckGo сам
    "duckduckgo.com",
}

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)

MAX_DOMAINS = 50
MAX_EMPTY_PAGES = 2  # Остановка если 2 страницы подряд без новых доменов
TIMEOUT = 10


# ============================================================================
# Утилиты
# ============================================================================

def _extract_domain(url: str) -> str:
    """Извлекает домен из URL (например, www.example.com → example.com)."""
    try:
        parsed = urlparse(url)
        domain = parsed.netloc
        # Убираем www. префикс
        if domain.startswith("www."):
            domain = domain[4:]
        return domain.lower()
    except Exception:
        return ""


def _is_excluded_domain(domain: str) -> bool:
    """Проверяет, входит ли домен в чёрный список."""
    domain_lower = domain.lower()

    for excluded in EXCLUDED_DOMAINS:
        excluded_lower = excluded.lower()
        # Проверяем оба направления
        if excluded_lower in domain_lower or domain_lower.endswith(excluded_lower):
            return True

    return False


def _is_valid_url(url: str) -> bool:
    """Проверяет, валидный ли URL."""
    if not url:
        return False
    return url.startswith(("http://", "https://"))


# ============================================================================
# Загрузка и парсинг
# ============================================================================

def fetch_html(query: str, page: int = 1) -> str | None:
    """
    Загружает HTML со страницы DuckDuckGo.

    Args:
        query: текстовый запрос
        page: номер страницы (1-based)

    Returns:
        HTML или None при ошибке
    """
    # DuckDuckGo пагинирует через параметр &s=НОМЕР_РЕЗУЛЬТАТА
    # На странице примерно 30 результатов
    start = (page - 1) * 30 + 1

    url = f"https://html.duckduckgo.com/html/?q={quote(query)}&s={start}"

    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ru-RU,ru;q=0.9",
        "Accept-Encoding": "gzip, deflate",
        "Connection": "keep-alive",
        "Referer": "https://html.duckduckgo.com/",
    }

    try:
        resp = requests.get(url, headers=headers, timeout=TIMEOUT)
        resp.raise_for_status()
        return resp.text
    except requests.exceptions.Timeout:
        print(f"[!] Таймаут при загрузке страницы {page}")
        return None
    except requests.exceptions.RequestException as e:
        print(f"[!] Ошибка загрузки (страница {page}): {e}")
        return None


def _extract_real_url(duckduckgo_url: str) -> str | None:
    """
    DuckDuckGo шифрует ссылки в формате:
    //duckduckgo.com/l/?uddg=URL_ENCODED&rut=...

    Извлекаем реальный URL из параметра uddg.
    """
    try:
        # Если это редирект DuckDuckGo
        if "uddg=" in duckduckgo_url:
            # Разбираем query-параметры
            parsed = urlparse(duckduckgo_url)
            params = parse_qs(parsed.query)

            if "uddg" in params and params["uddg"]:
                # uddg значение уже URL-декодировано parse_qs
                real_url = params["uddg"][0]
                # Но может быть ещё кодирование, декодируем ещё раз
                real_url = unquote(real_url)
                if real_url.startswith(("http://", "https://")):
                    return real_url

        # Если это уже реальный URL
        if duckduckgo_url.startswith(("http://", "https://")):
            return duckduckgo_url

        # Если это //... (без схемы), добавляем https://
        if duckduckgo_url.startswith("//"):
            return "https:" + duckduckgo_url

        return None
    except Exception:
        return None


def parse_results(html: str) -> List[Tuple[str, str]]:
    """
    Парсит HTML результатов DuckDuckGo.

    Args:
        html: HTML текст страницы

    Returns:
        Список кортежей (url, title)
    """
    results = []

    try:
        soup = BeautifulSoup(html, "html.parser")

        # DuckDuckGo HTML использует <div class="result"> для каждого результата
        # Внутри: <h2 class="result__title"> → <a class="result__a"> содержит href и текст

        for result_div in soup.find_all("div", class_="result"):
            # Ищем ссылку в title
            title_h2 = result_div.find("h2", class_="result__title")
            if not title_h2:
                continue

            link = title_h2.find("a", class_="result__a")
            if not link:
                continue

            # Извлекаем URL из href (может быть зашифрован)
            href = link.get("href", "").strip()
            real_url = _extract_real_url(href)

            # Извлекаем title
            title = link.get_text(strip=True)

            if real_url and title:
                results.append((real_url, title))

        return results

    except Exception as e:
        print(f"[!] Ошибка парсинга HTML: {e}")
        return []


def filter_domains(results: List[Tuple[str, str]]) -> dict[str, str]:
    """
    Фильтрует результаты:
    - убирает исключённые домены
    - дедупликация по домену (1 URL на домен)

    Args:
        results: список (url, title) с поиска

    Returns:
        dict {domain: url}
    """
    filtered = {}

    for url, title in results:
        # Извлекаем домен
        domain = _extract_domain(url)
        if not domain:
            continue

        # Пропускаем исключённые домены
        if _is_excluded_domain(domain):
            continue

        # Дедупликация: берём первый URL для каждого домена
        if domain not in filtered:
            filtered[domain] = url

    return filtered


# ============================================================================
# Основной поиск
# ============================================================================

def search(query: str, verbose: bool = False) -> List[str]:
    """
    Поиск сайтов компаний по текстовому запросу.

    Args:
        query: текстовый запрос (например, "стоматологии в челябинске")
        verbose: выводить отладочную информацию

    Returns:
        list[str] — список уникальных URL (до 50)
    """
    if not query or not query.strip():
        print("[!] Пустой запрос")
        return []

    all_domains = {}  # {domain: url}
    empty_pages = 0
    page = 1

    if verbose:
        print(f"\n[*] Поиск: '{query}'")
        print(f"[*] Максимум {MAX_DOMAINS} доменов, останавливается при {MAX_EMPTY_PAGES} пустых страницах подряд\n")

    while len(all_domains) < MAX_DOMAINS and empty_pages < MAX_EMPTY_PAGES:
        if verbose:
            print(f"[*] Страница {page}...", end=" ")

        # Загружаем страницу
        html = fetch_html(query, page)
        if not html:
            break

        # Парсим результаты
        results = parse_results(html)
        if not results:
            if verbose:
                print("нет результатов")
            empty_pages += 1
            page += 1
            continue

        if verbose:
            print(f"({len(results)} результатов)", end="")

        # Фильтруем
        page_domains = filter_domains(results)

        # Считаем новые домены
        new_count = len([d for d in page_domains if d not in all_domains])

        # Добавляем в общий результат
        all_domains.update(page_domains)

        if verbose:
            print(f" → {new_count} новых доменов (всего {len(all_domains)})")

        # Проверяем: есть ли новые домены?
        if new_count == 0:
            empty_pages += 1
        else:
            empty_pages = 0

        page += 1

    # Возвращаем список URL (до MAX_DOMAINS)
    urls = list(all_domains.values())[:MAX_DOMAINS]

    if verbose:
        print(f"\n[✓] Найдено {len(urls)} уникальных доменов\n")

    return urls


# ============================================================================
# CLI
# ============================================================================

def main():
    """Интерфейс командной строки."""
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    else:
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

    if len(sys.argv) < 2:
        print("Использование: python search_duckduckgo.py '<ЗАПРОС>'")
        print("\nПримеры:")
        print("  python search_duckduckgo.py 'стоматологии в челябинске'")
        print("  python search_duckduckgo.py 'клиники в москве'")
        print("  python search_duckduckgo.py 'франчайзи 1с'")
        sys.exit(1)

    query = " ".join(sys.argv[1:])

    # Поиск с выводом информации
    urls = search(query, verbose=True)

    # Вывод результатов
    if urls:
        print("=" * 80)
        print("РЕЗУЛЬТАТЫ:")
        print("=" * 80)
        for i, url in enumerate(urls, 1):
            print(f"{i:>3}. {url}")
        print("=" * 80)
    else:
        print("[!] Ничего не найдено")


if __name__ == "__main__":
    main()
