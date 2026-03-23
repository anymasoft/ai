#!/usr/bin/env python3
"""
Crawler для enrichment — находит релевантные страницы сайта компании.

Основная функция:
    get_relevant_links(domain: str) -> list[str]
        Возвращает топ-5 URL для обхода (homepage + контактные страницы).

Вспомогательная функция:
    fetch_url(url: str) -> str | None
        Скачивает страницу (используется в enrich.py).
"""

import urllib.request
import urllib.error
from urllib.parse import urljoin, urlparse, unquote

from bs4 import BeautifulSoup

# ---------------------------------------------------------------------------
# Конфигурация
# ---------------------------------------------------------------------------

MAX_LINKS = 5                             # максимум ссылок для обхода
FETCH_TIMEOUT = 15                        # таймаут HTTP-запроса (сек)
MAX_RESPONSE_BYTES = 5 * 1024 * 1024     # лимит ответа — 5 МБ

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/120.0.0.0 Safari/537.36"
)

# Расширения файлов — не страницы
_EXCLUDED_EXTENSIONS = {
    ".css", ".js", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico",
    ".pdf", ".xml", ".json", ".zip", ".rar", ".mp3", ".mp4",
    ".woff", ".woff2", ".ttf", ".eot", ".map",
}

# Технический и юридический мусор в путях
_EXCLUDED_PATTERNS = [
    "/bitrix/", "/wp-content/", "/wp-includes/", "/wp-admin/",
    "/admin/", "/api/", "/static/", "/assets/", "/cache/",
    "/cgi-bin/", "/feed/", "/rss/", "/ajax/", "/upload/",
    "privacy", "terms", "cookie", "legal", "politika",
    "personal-data", "agreement", "oferta",
]

# Ключевые слова контактных страниц в URL
_CONTACT_URL_KEYWORDS = [
    "contact", "contacts", "kontakt", "kontakty",
    "контакты", "контакт", "связаться", "свяжитесь", "svyaz",
    "about", "о-нас", "o-nas", "о-компании", "o-kompanii",
    "обратная-связь", "feedback",
    "company", "office", "офис", "адрес", "rekvizity", "реквизиты",
]

# Ключевые слова в тексте якоря
_CONTACT_ANCHOR_KEYWORDS = [
    "контакты", "контакт", "contact", "contacts",
    "о нас", "о компании", "about", "связаться",
    "написать", "написать нам", "позвонить",
    "адрес", "офис", "телефон",
]


# ---------------------------------------------------------------------------
# HTTP fetch
# ---------------------------------------------------------------------------

def fetch_url(url: str) -> str | None:
    """
    Скачивает страницу по URL.
    Возвращает HTML-строку или None при ошибке.
    """
    try:
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=FETCH_TIMEOUT) as resp:
            content_type = resp.headers.get("Content-Type", "")
            # Пропускаем не-HTML (бинарные файлы и т.д.)
            if content_type and "text" not in content_type and "html" not in content_type:
                return None
            raw = resp.read(MAX_RESPONSE_BYTES)
    except Exception:
        return None

    # Определяем кодировку из Content-Type или пробуем по очереди
    charset = "utf-8"
    if "charset=" in content_type:
        charset = content_type.split("charset=")[-1].strip().split(";")[0].strip()

    for enc in (charset, "utf-8", "cp1251", "latin-1"):
        try:
            return raw.decode(enc, errors="strict")
        except (UnicodeDecodeError, LookupError):
            continue

    return raw.decode("utf-8", errors="replace")


# ---------------------------------------------------------------------------
# Нормализация и фильтрация ссылок
# ---------------------------------------------------------------------------

def _normalize_url(url: str) -> str:
    """Нормализует URL: lowercase, убирает fragment/query/trailing slash."""
    url = unquote(url).lower()
    url = url.split("#")[0]
    parsed = urlparse(url)
    url = parsed._replace(query="").geturl()
    return url.rstrip("/")


def _is_same_domain(url: str, base_netloc: str) -> bool:
    """True если URL принадлежит тому же домену."""
    return urlparse(url).netloc == base_netloc


def _is_valid_link(url: str) -> bool:
    """True если ссылка является реальной страницей (не мусор)."""
    low = url.lower()

    # Исключаем не-HTTP протоколы и fragment-only ссылки
    if low.startswith(("mailto:", "tel:", "javascript:", "data:", "ftp:", "#")):
        return False

    parsed = urlparse(low)
    path = parsed.path

    # Исключаем файлы по расширению
    for ext in _EXCLUDED_EXTENSIONS:
        if path.endswith(ext):
            return False

    # Исключаем технические и юридические страницы
    for pat in _EXCLUDED_PATTERNS:
        if pat in path:
            return False

    return True


def _score_url(url: str, anchor: str) -> int:
    """Оценивает релевантность ссылки. Выше = больший приоритет для обхода."""
    score = 0
    path = urlparse(url).path.lower()
    low_anchor = (anchor or "").lower()

    # Homepage — обязательно, высокий приоритет
    if path in ("", "/"):
        score += 80

    # Контактные ключевые слова в пути
    for kw in _CONTACT_URL_KEYWORDS:
        if kw in path:
            score += 50
            break

    # Контактные ключевые слова в якоре
    for kw in _CONTACT_ANCHOR_KEYWORDS:
        if kw in low_anchor:
            score += 30
            break

    # Штраф за глубину вложенности
    depth = len([s for s in path.strip("/").split("/") if s])
    if depth > 2:
        score -= 20

    return score


# ---------------------------------------------------------------------------
# Главная функция
# ---------------------------------------------------------------------------

def get_relevant_links(domain: str) -> list[str]:
    """
    Возвращает топ-5 релевантных URL для обхода сайта.

    Args:
        domain: чистый домен без схемы (пример: "example.com")
                или с схемой ("https://example.com").

    Returns:
        Список URL (homepage всегда первым), пустой если сайт недоступен.
    """
    # Добавляем схему если отсутствует
    if not domain.startswith(("http://", "https://")):
        base_url = f"https://{domain}"
    else:
        base_url = domain.rstrip("/")

    base_netloc = urlparse(base_url).netloc

    # Скачиваем homepage
    html = fetch_url(base_url)

    # Fallback: http если https недоступен
    if html is None and base_url.startswith("https://"):
        http_url = "http://" + base_url[len("https://"):]
        html = fetch_url(http_url)
        if html is not None:
            base_url = http_url

    if html is None:
        return []  # сайт недоступен

    # Извлекаем все ссылки с якорями
    try:
        soup = BeautifulSoup(html, "html.parser")
        raw_links = []
        for tag in soup.find_all("a", href=True):
            href = tag["href"].strip()
            anchor = tag.get_text(strip=True)
            absolute = urljoin(base_url, href)
            if _is_same_domain(absolute, base_netloc) and _is_valid_link(absolute):
                raw_links.append((absolute, anchor))
    except Exception:
        raw_links = []

    # Нормализуем и дедуплицируем (сохраняем лучший якорь)
    seen: dict[str, str] = {}
    for url, anchor in raw_links:
        norm = _normalize_url(url)
        if norm not in seen or (anchor and not seen[norm]):
            seen[norm] = anchor

    # Скорим и сортируем
    scored = sorted(
        [(url, _score_url(url, anchor)) for url, anchor in seen.items()],
        key=lambda x: x[1],
        reverse=True,
    )

    # Формируем результат: homepage всегда первым
    homepage = _normalize_url(base_url)
    result = [homepage]
    result_set = {homepage}

    for url, _ in scored:
        if len(result) >= MAX_LINKS:
            break
        if url not in result_set:
            result.append(url)
            result_set.add(url)

    return result
