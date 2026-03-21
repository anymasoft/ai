#!/usr/bin/env python3
"""
LeadExtractor Crawler + Link Filter — Production Pipeline
1. URL → 2. Crawl4AI → HTML → 3. extract links → 4. filter_links() → 5. top URLs
"""

import sys
import re
from pathlib import Path
from urllib.parse import urljoin, urlparse, unquote
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
MAX_LINKS = 20
MAX_PER_SEGMENT = 3  # diversity: макс. ссылок с одинаковым первым сегментом
DIVERSITY_BYPASS_SCORE = 120  # score >= этого → обход diversity-фильтра

# ---------------------------------------------------------------------------
# ШАГ 1: HARD FILTER
# ---------------------------------------------------------------------------

EXCLUDED_EXTENSIONS = {
    ".css", ".js", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico",
    ".pdf", ".xml", ".json", ".zip", ".rar", ".7z", ".tar", ".gz",
    ".mp3", ".mp4", ".avi", ".mov", ".wmv", ".flv", ".webm", ".woff",
    ".woff2", ".ttf", ".eot", ".map",
}

# Hard filter — ТОЛЬКО технический мусор (не контентные страницы!)
EXCLUDED_PATTERNS = [
    "/bitrix/", "/wp-content/", "/wp-includes/", "/wp-admin/",
    "/admin/", "/api/", "/static/", "/assets/", "/cache/",
    "/cgi-bin/", "/feed/", "/rss/", "/print/", "/ajax/",
    "/upload/", "/uploads/",
]

EXCLUDED_PREFIXES = ("mailto:", "tel:", "javascript:", "data:", "ftp:")

# ---------------------------------------------------------------------------
# ШАГ 3: SCORING — ключевые слова
# ---------------------------------------------------------------------------

POSITIVE_URL_KEYWORDS = {
    # +200 — прямые контакты (МАКСИМАЛЬНЫЙ ПРИОРИТЕТ)
    200: [
        "contact", "contacts", "kontakt", "kontakty", "kontakte",
        "контакты", "контакт", "связаться", "svyaz", "обратная-связь",
        "feedback-form", "write-us", "napisat",
    ],
    # +60 — о компании
    60: [
        "about", "about-us", "aboutus", "о-нас", "o-nas", "о-компании",
        "o-kompanii", "who-we-are", "our-company", "кто-мы",
    ],
    # +50 — команда / офис / реквизиты
    50: [
        "company", "team", "команда", "office", "офис", "адрес", "adres",
        "реквизиты", "requisites", "rekvizity", "legal", "юридический",
        "requisity", "details", "our-team", "management", "руководство",
        "sotrudniki", "сотрудники", "филиалы", "branches", "offices",
    ],
    # +40 — поддержка
    40: [
        "support", "help", "feedback", "обратная", "поддержка", "pomosh",
        "помощь", "faq", "вопросы", "ask", "inquiry", "запрос",
    ],
}

NEGATIVE_URL_KEYWORDS = {
    # -80 — каталог / товары (мягкий штраф, НЕ исключение)
    -80: [
        "catalog", "catalogue", "shop", "store", "cart", "checkout",
        "корзина", "оплата", "payment", "order", "zakaz",
    ],
    # -50 — товары / цены
    -50: [
        "product", "products", "tovar", "tovary", "price", "prices",
        "prays", "цена", "цены",
    ],
    # -40 — юр. документы / политики
    -40: [
        "privacy", "policy", "agreement", "terms", "cookies", "gdpr",
        "politika", "конфиденциальност", "соглашение", "оферта", "oferta",
        "blog", "news", "article", "post", "novosti", "новости", "статья",
        "stati", "press", "публикации", "publications", "journal",
        "tags", "tag", "category", "archive", "media",
    ],
    # -30 — портфолио / проекты / авторизация
    -30: [
        "project", "projects", "case", "cases", "portfolio", "проект",
        "проекты", "кейс", "кейсы", "портфолио",
        "login", "register", "signup", "signin", "auth", "oauth",
        "password", "recovery", "войти", "регистрация",
    ],
}

POSITIVE_ANCHOR_KEYWORDS = {
    # +100 — прямые контактные слова (HIGH PRIORITY)
    100: [
        "контакты", "контакт", "contact", "contacts", "связаться",
        "написать нам", "напишите нам", "свяжитесь", "обратная связь",
        "write us", "call us", "get in touch", "reach us",
    ],
    # +80 — о компании (MEDIUM)
    80: [
        "о нас", "о компании", "about", "about us", "about company",
        "кто мы", "наша компания", "our company", "who we are",
    ],
    # +60 — офисы / адреса / команда (LOWER)
    60: [
        "офисы", "филиалы", "адрес", "адреса", "locations", "offices",
        "наш адрес", "где мы", "как добраться", "наша команда",
        "команда", "team", "our team", "реквизиты",
        "телефон", "email", "e-mail", "позвонить", "звоните",
    ],
}

NEGATIVE_ANCHOR_KEYWORDS = {
    # -40 — контент / новости / блог
    -40: [
        "новости", "блог", "статьи", "news", "blog", "articles",
        "пресс", "press", "публикации", "publications",
    ],
}


# ---------------------------------------------------------------------------
# Функции из crawler.py (fetch / extract)
# ---------------------------------------------------------------------------

def read_urls(filepath: Path) -> List[str]:
    if not filepath.exists():
        print(f"[!] Файл не найден: {filepath}")
        return []
    with open(filepath, "r", encoding="utf-8") as f:
        return [line.strip() for line in f if line.strip() and not line.startswith("#")]


def get_domain(url: str) -> str:
    parsed = urlparse(url)
    return f"{parsed.scheme}://{parsed.netloc}"


def is_same_domain(url: str, base_url: str) -> bool:
    return urlparse(url).netloc == urlparse(base_url).netloc


def extract_links_with_anchors(html: str, base_url: str) -> list[tuple[str, str]]:
    """Извлекает пары (url, anchor_text) из HTML."""
    results = []
    try:
        soup = BeautifulSoup(html, "html.parser")
        for tag in soup.find_all("a", href=True):
            href = tag["href"].strip()
            anchor = tag.get_text(strip=True)
            absolute = urljoin(base_url, href)
            if is_same_domain(absolute, base_url):
                results.append((absolute, anchor))
    except Exception as e:
        print(f"[!] Ошибка парсинга HTML: {e}")
    return results


async def fetch_page_crawl4ai(url: str) -> str | None:
    try:
        async with AsyncWebCrawler() as crawler:
            result = await crawler.arun(url)
            return result.html if result.html else None
    except Exception as e:
        print(f"[!] crawl4ai ошибка для {url}: {e}")
        return None


def fetch_page_fallback(url: str) -> str | None:
    try:
        import urllib.request
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as response:
            return response.read().decode("utf-8", errors="ignore")
    except Exception as e:
        print(f"[!] urllib ошибка для {url}: {e}")
        return None


async def fetch_page(url: str) -> str | None:
    if HAS_CRAWL4AI:
        html = await fetch_page_crawl4ai(url)
        if html:
            return html
    return fetch_page_fallback(url)


# ---------------------------------------------------------------------------
# ШАГ 1: HARD FILTER
# ---------------------------------------------------------------------------

def _hard_filter(url: str) -> bool:
    """True = ссылка проходит фильтр (НЕ мусор)."""
    low = url.lower()

    if low.startswith(EXCLUDED_PREFIXES):
        return False

    parsed = urlparse(low)
    path = parsed.path

    # расширения
    for ext in EXCLUDED_EXTENSIONS:
        if path.endswith(ext):
            return False

    # паттерны
    for pat in EXCLUDED_PATTERNS:
        if pat in path:
            return False

    return True


# ---------------------------------------------------------------------------
# ШАГ 2: НОРМАЛИЗАЦИЯ
# ---------------------------------------------------------------------------

def normalize(url: str) -> str:
    """lower, убрать #anchor, ВСЕ query-параметры, trailing /"""
    url = unquote(url).lower()
    url = url.split("#")[0]

    # полностью удаляем query-параметры (?city=..., ?page=..., utm_... и т.д.)
    parsed = urlparse(url)
    url = parsed._replace(query="").geturl()

    url = url.rstrip("/")
    return url


# ---------------------------------------------------------------------------
# ШАГ 3: SCORING
# ---------------------------------------------------------------------------

def _url_depth(url: str) -> int:
    """Количество сегментов пути."""
    path = urlparse(url).path.strip("/")
    if not path:
        return 0
    return len(path.split("/"))


def _score_link(url: str, anchor: str, base_domain: str) -> int:
    """Считает score для одной ссылки."""
    score = 0
    low_url = url.lower()
    low_anchor = anchor.lower() if anchor else ""
    path = urlparse(low_url).path.lower()

    # 3.1 positive keywords (URL path)
    for points, keywords in POSITIVE_URL_KEYWORDS.items():
        for kw in keywords:
            if kw in path:
                score += points
                break  # одно совпадение на группу

    # 3.2 negative keywords (URL path)
    for points, keywords in NEGATIVE_URL_KEYWORDS.items():
        for kw in keywords:
            if kw in path:
                score += points  # points уже отрицательные
                break

    # 3.3 depth scoring (мягкий — не режем, а штрафуем)
    depth = _url_depth(url)
    if depth <= 2:
        score += 10
    elif depth > 3:
        score -= 20

    # 3.4 anchor text scoring (positive)
    for points, keywords in POSITIVE_ANCHOR_KEYWORDS.items():
        for kw in keywords:
            if kw in low_anchor:
                score += points
                break

    # 3.4.1 anchor text scoring (negative)
    for points, keywords in NEGATIVE_ANCHOR_KEYWORDS.items():
        for kw in keywords:
            if kw in low_anchor:
                score += points
                break

    # 3.5 homepage bonus
    if path in ("", "/"):
        score += 80

    return score


# ---------------------------------------------------------------------------
# ГЛАВНАЯ ФУНКЦИЯ: filter_links()
# ---------------------------------------------------------------------------

def filter_links(links: list[tuple[str, str]], base_domain: str) -> list[str]:
    """
    Production link filtering engine.

    links: [(url, anchor_text), ...]
    base_domain: домен сайта (scheme://host)
    return: отфильтрованный список URL, отсортированный по score DESC
    """

    # ШАГ 1: hard filter
    passed = [(url, anchor) for url, anchor in links if _hard_filter(url)]

    # ШАГ 2: нормализация + дедупликация
    seen = {}  # normalized_url -> (original_url, anchor, ...)
    for url, anchor in passed:
        norm = normalize(url)
        if norm not in seen:
            seen[norm] = (norm, anchor)

    # ШАГ 3: scoring
    scored = []
    for norm_url, anchor in seen.values():
        s = _score_link(norm_url, anchor, base_domain)
        depth = _url_depth(norm_url)
        scored.append((norm_url, s, depth, anchor))

    # ШАГ 4: сортировка по score DESC
    scored.sort(key=lambda x: x[1], reverse=True)

    # ШАГ 5: diversity filter + top N
    # максимум MAX_PER_SEGMENT ссылок с одинаковым первым сегментом пути
    segment_count = {}  # первый сегмент → количество
    top = []
    for item in scored:
        if len(top) >= MAX_LINKS:
            break
        norm_url, s, depth, anchor = item
        # bypass: сильные ссылки (контакты, о нас) обходят diversity-лимит
        if s >= DIVERSITY_BYPASS_SCORE:
            top.append(item)
            continue
        seg = urlparse(norm_url).path.strip("/").split("/")[0] if urlparse(norm_url).path.strip("/") else ""
        count = segment_count.get(seg, 0)
        if seg and count >= MAX_PER_SEGMENT:
            continue
        top.append(item)
        segment_count[seg] = count + 1

    # ШАГ 6: гарантии — обязательные страницы (добавляем, даже если не вошли в top)
    guaranteed_patterns = [
        ("contact", lambda u: any(k in urlparse(u).path for k in
            ["contact", "kontakt", "контакт", "связ", "svyaz"])),
        ("about", lambda u: any(k in urlparse(u).path for k in
            ["about", "о-нас", "o-nas", "о-компании", "o-kompanii"])),
    ]

    top_urls = {item[0] for item in top}
    for label, check_fn in guaranteed_patterns:
        for norm_url, s, depth, anchor in scored:
            if check_fn(norm_url) and norm_url not in top_urls:
                top.append((norm_url, s, depth, anchor))
                top_urls.add(norm_url)
                break

    # ШАГ 6.1: homepage ВСЕГДА на позиции #1
    homepage = normalize(base_domain)
    # убираем дубли homepage из списка
    top = [item for item in top if item[0] != homepage]
    # вставляем в начало
    top.insert(0, (homepage, 999, 0, "homepage"))
    # обрезаем хвост если превысили лимит (homepage не трогаем)
    if len(top) > MAX_LINKS + 1:
        top = top[:MAX_LINKS + 1]

    # ШАГ 7: отладочный вывод
    print(f"\n{'='*95}")
    print(f"  FILTERED LINKS ({len(top)} из {len(links)} исходных)")
    print(f"{'='*95}")
    print(f"  {'URL':<50} {'ANCHOR':<20} {'SCORE':>6} {'DEPTH':>5}")
    print(f"  {'-'*50} {'-'*20} {'-'*6} {'-'*5}")
    for norm_url, s, depth, anchor in top:
        u = norm_url if len(norm_url) <= 50 else norm_url[:47] + "..."
        a = anchor if len(anchor) <= 20 else anchor[:17] + "..."
        print(f"  {u:<50} {a:<20} {s:>6} {depth:>5}")
    print(f"{'='*95}\n")

    return [item[0] for item in top]


# ---------------------------------------------------------------------------
# Pipeline: crawl + filter
# ---------------------------------------------------------------------------

def process_url(url: str) -> list[str]:
    """Полный pipeline: fetch → extract → filter."""
    import asyncio

    print(f"\n[*] Crawling: {url}")

    html = asyncio.run(fetch_page(url))
    if not html:
        print(f"[!] Не удалось скачать: {url}")
        return []

    # извлекаем все ссылки с anchor-текстом
    raw_links = extract_links_with_anchors(html, url)
    print(f"[*] Извлечено ссылок: {len(raw_links)}")

    # фильтруем
    base_domain = get_domain(url)
    filtered = filter_links(raw_links, base_domain)

    return filtered


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    else:
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

    urls = read_urls(URLS_FILE)
    if not urls:
        print(f"[!] Нет URL в {URLS_FILE}")
        return

    print(f"[*] Загружено {len(urls)} URL из {URLS_FILE}")

    for url in urls:
        try:
            filtered = process_url(url.strip())
            if filtered:
                print("FILTERED LINKS:")
                for i, link in enumerate(filtered, 1):
                    print(f"  {i:>2}. {link}")
                print()
        except KeyboardInterrupt:
            print("\n[*] Прервано")
            break
        except Exception as e:
            print(f"[!] Ошибка: {url} — {e}")


if __name__ == "__main__":
    main()
