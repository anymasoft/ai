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

# Агрегаторы и каталоги — АГРЕССИВНЫЙ ФИЛЬТР
BLACKLIST_DOMAINS = {
    "zoon.ru",
    "flamp.ru",
    "yandex.ru",
    "2gis.ru",
    "google.com",
    "avito.ru",
    "jsprav.ru",
    "rubrikator.org",
    "narule.ru",
    "ya38.ru",
    "likeability.ru",
    "ipoteka.ru",
    "ru-ru.facebook.com",
    "web.telegram.org",
    "t.me",
    "instagram.com",
    "vk.com",
}

# URL паттерны которые указывают на каталоги/агрегаторы
CATALOG_PATTERNS = {
    "/catalog",
    "/category",
    "/type",
    "/org",
    "/orgs",
    "/list",
    "/search",
    "/filter",
    "/companies",
    "/organizations",
    "/business",
    "/results",
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


def _is_blacklisted_domain(domain: str) -> bool:
    """Проверяет домен против BLACKLIST_DOMAINS."""
    domain_lower = domain.lower()
    for blacklisted in BLACKLIST_DOMAINS:
        if blacklisted.lower() in domain_lower or domain_lower.endswith(blacklisted.lower()):
            return True
    return False


def _has_catalog_pattern(url: str) -> bool:
    """Проверяет наличие паттернов каталогов в URL."""
    url_lower = url.lower()
    for pattern in CATALOG_PATTERNS:
        if pattern in url_lower:
            return True
    return False


def _calculate_url_depth(url: str) -> int:
    """
    Вычисляет глубину URL.
    site.ru → 0
    site.ru/page → 1
    site.ru/a/b → 2
    """
    try:
        parsed = urlparse(url)
        path = parsed.path.strip("/")
        if not path:
            return 0
        # Считаем слэши в пути
        depth = path.count("/")
        return depth
    except Exception:
        return 0


def _is_suspicious_domain(domain: str) -> bool:
    """
    Проверяет качество домена по эвристикам:
    - длина > 25 символов
    - много дефисов (> 2)
    - выглядит как агрегатор
    """
    if len(domain) > 25:
        return True

    # Много дефисов = подозрительно (агрегаторы часто называются так)
    dash_count = domain.count("-")
    if dash_count > 2:
        return True

    # Много точек = подозрительно
    dot_count = domain.count(".")
    if dot_count > 3:
        return True

    return False


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


def filter_company_sites(urls: List[str]) -> List[str]:
    """
    АГРЕССИВНЫЙ фильтр для отсеивания агрегаторов и каталогов.
    Оставляет только сайты с высокой вероятностью наличия контактов.

    Применяет фильтры (в порядке приоритета):
    1. BLACKLIST_DOMAINS — агрегаторы и каталоги
    2. CATALOG_PATTERNS — URL паттерны (/catalog, /list, и т.д.)
    3. URL depth — если глубина > 2 → удалить
    4. Domain quality — подозрительные домены

    Args:
        urls: список URL с поиска

    Returns:
        список отфильтрованных URL
    """
    filtered = {}  # {domain: url}

    for url in urls:
        if not _is_valid_url(url):
            continue

        domain = _extract_domain(url)
        if not domain:
            continue

        # Фильтр 1: BLACKLIST_DOMAINS
        if _is_blacklisted_domain(domain):
            continue

        # Фильтр 2: URL паттерны каталогов
        if _has_catalog_pattern(url):
            continue

        # Фильтр 3: Глубина URL (агрессивный фильтр)
        depth = _calculate_url_depth(url)
        if depth > 2:
            continue

        # Фильтр 4: Качество домена
        if _is_suspicious_domain(domain):
            continue

        # Дедупликация по домену (берём первый URL)
        if domain not in filtered:
            filtered[domain] = url

    return list(filtered.values())


# ============================================================================
# Основной поиск
# ============================================================================

def search(query: str, verbose: bool = False, strict_filter: bool = True) -> List[str]:
    """
    Поиск сайтов компаний по текстовому запросу.

    Args:
        query: текстовый запрос (например, "стоматологии в челябинске")
        verbose: выводить отладочную информацию
        strict_filter: применять агрессивный фильтр агрегаторов (по умолчанию True)

    Returns:
        list[str] — список уникальных URL
    """
    if not query or not query.strip():
        print("[!] Пустой запрос")
        return []

    all_domains = {}  # {domain: url}
    empty_pages = 0
    page = 1
    max_iterations = MAX_DOMAINS * 2  # Ищем больше чтобы потом отфильтровать

    if verbose:
        print(f"\n[*] Поиск: '{query}'")
        print(f"[*] Максимум {MAX_DOMAINS} доменов, останавливается при {MAX_EMPTY_PAGES} пустых страницах подряд\n")

    while len(all_domains) < max_iterations and empty_pages < MAX_EMPTY_PAGES:
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

        # Фильтруем базовые исключения
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

    # Получаем список URL
    urls = list(all_domains.values())

    # Применяем агрессивный фильтр если он включен
    if strict_filter:
        if verbose:
            before_count = len(urls)
        urls = filter_company_sites(urls)
        if verbose:
            after_count = len(urls)
            removed = before_count - after_count
            print(f"[*] Фильтрация: {before_count} → {after_count} (удалено {removed} агрегаторов)\n")
    else:
        if verbose:
            print()

    # Ограничиваем результат
    urls = urls[:MAX_DOMAINS]

    if verbose:
        print(f"[✓] Найдено {len(urls)} уникальных сайтов компаний\n")

    return urls


# ============================================================================
# CLI
# ============================================================================

def read_query_from_file() -> str | None:
    """
    Пытается прочитать запрос из query.txt рядом со скриптом.
    Возвращает содержимое или None если файла нет.
    """
    from pathlib import Path

    script_dir = Path(__file__).parent
    query_file = script_dir / "query.txt"

    if query_file.exists():
        try:
            with open(query_file, "r", encoding="utf-8") as f:
                content = f.read().strip()
                if content:
                    return content
        except Exception as e:
            print(f"[!] Ошибка при чтении query.txt: {e}")

    return None


def main():
    """Интерфейс командной строки."""
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    else:
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

    # Приоритет 1: query.txt рядом со скриптом
    query = read_query_from_file()

    # Приоритет 2: аргумент командной строки
    if not query and len(sys.argv) > 1:
        query = " ".join(sys.argv[1:])

    # Если ничего не найдено — ошибка
    if not query:
        print("Использование:")
        print("  Вариант 1: поместите запрос в файл query.txt рядом со скриптом")
        print("  Вариант 2: python search_duckduckgo.py '<ЗАПРОС>'")
        print("\nПримеры query.txt:")
        print("  стоматологии в челябинске")
        print("  клиники в москве")
        print("  франчайзи 1с")
        print("\nИли через аргумент:")
        print("  python search_duckduckgo.py 'стоматологии в челябинске'")
        sys.exit(1)

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
