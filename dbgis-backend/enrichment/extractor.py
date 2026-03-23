#!/usr/bin/env python3
"""
Extractor для enrichment — извлечение email и телефонов из HTML.

Основная функция:
    extract_contacts(html: str) -> dict
        Возвращает {"emails": [...], "phones": [...]}.

Логика адаптирована из EXTRACTOR/extractor_final.py (посимвольный сбор,
chardet-опциональный, data-* атрибуты, JSON-LD, tel:/mailto: href,
локальные номера в скобках, structured microdata).
"""

import re
import html as html_module
import json
from urllib.parse import unquote

from bs4 import BeautifulSoup, Comment

# ---------------------------------------------------------------------------
# Конфигурация
# ---------------------------------------------------------------------------

_FAKE_EMAIL_EXTENSIONS = {
    "png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "bmp", "tiff",
    "js", "css", "woff", "woff2", "ttf", "eot", "map", "json", "xml",
}

_VALID_TLDS = {
    "ru", "com", "net", "org", "info", "biz", "рф", "su",
    "pro", "me", "io", "co", "uk", "de", "fr", "by", "ua", "kz",
    "edu", "gov", "mil", "int", "name", "travel", "museum",
}

_EMAIL_STOP_PATTERNS = [
    re.compile(r"image@\d+x", re.IGNORECASE),
    re.compile(r"icon@\d+x", re.IGNORECASE),
    re.compile(r"@\d+x\.", re.IGNORECASE),
    re.compile(r"example\.com$", re.IGNORECASE),
    re.compile(r"^test@", re.IGNORECASE),
    re.compile(r"^demo@", re.IGNORECASE),
    re.compile(r"^sample@", re.IGNORECASE),
]

# Fallback коды городов России (если codes.txt недоступен)
_FALLBACK_CODES = {
    "495", "499", "812", "800",
    "343", "383", "831", "846", "863",
    "351", "861", "843", "845", "342",
    "391", "473", "347", "8442",
}

# ---------------------------------------------------------------------------
# Очистка HTML
# ---------------------------------------------------------------------------

def _clean_html(raw_html: str) -> tuple[str, list[str], BeautifulSoup]:
    """
    Очищает HTML и возвращает (чистый_текст, список_href, soup).

    1. URL-декодирование + HTML-entity декодирование
    2. Удаление script/style/noscript/комментариев
    3. Извлечение href-атрибутов
    4. get_text() с separator=" "
    """
    text = unquote(raw_html)
    text = html_module.unescape(text)
    text = text.replace("\xa0", " ")

    soup = BeautifulSoup(text, "html.parser")

    for tag in soup.find_all(["script", "style", "noscript"]):
        tag.decompose()

    for comment in soup.find_all(string=lambda t: isinstance(t, Comment)):
        comment.extract()

    hrefs = []
    for a_tag in soup.find_all("a", href=True):
        href = a_tag["href"]
        href = html_module.unescape(unquote(href))
        hrefs.append(href)

    clean_text = soup.get_text(separator=" ")
    clean_text = re.sub(r"\s+", " ", clean_text)

    return clean_text, hrefs, soup


# ---------------------------------------------------------------------------
# Email
# ---------------------------------------------------------------------------

_EMAIL_RE = re.compile(
    r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}",
    re.IGNORECASE,
)


def _is_valid_email(email: str) -> bool:
    tld = email.rsplit(".", 1)[-1].lower()
    if tld in _FAKE_EMAIL_EXTENSIONS:
        return False
    if tld not in _VALID_TLDS:
        return False
    for pattern in _EMAIL_STOP_PATTERNS:
        if pattern.search(email):
            return False
    return True


def _extract_emails_from_text(text: str) -> list[str]:
    candidates = _EMAIL_RE.findall(text)
    seen = set()
    result = []
    for email in candidates:
        normalized = email.lower()
        if normalized not in seen and _is_valid_email(normalized):
            seen.add(normalized)
            result.append(normalized)
    return result


def _extract_emails_from_hrefs(hrefs: list[str]) -> list[str]:
    emails = []
    for href in hrefs:
        if href.lower().startswith("mailto:"):
            addr = href[7:].split("?")[0].strip().lower()
            if _EMAIL_RE.fullmatch(addr) and _is_valid_email(addr):
                emails.append(addr)
    return emails


def _extract_emails_from_data_attrs(soup: BeautifulSoup) -> list[str]:
    emails = []
    for tag in soup.find_all():
        attrs = getattr(tag, "attrs", None)
        if not isinstance(attrs, dict):
            continue
        for attr_name, attr_value in attrs.items():
            if not isinstance(attr_name, str) or not attr_name.startswith("data-"):
                continue
            values = attr_value if isinstance(attr_value, list) else [attr_value]
            for val in values:
                if isinstance(val, str) and "@" in val:
                    match = _EMAIL_RE.search(val)
                    if match:
                        addr = match.group(0).lower()
                        if _is_valid_email(addr):
                            emails.append(addr)
    return emails


# ---------------------------------------------------------------------------
# Телефоны
# ---------------------------------------------------------------------------

_PHONE_START_RE = re.compile(
    r"(?<!\d)"
    r"(?:"
    r"\+\s*7"
    r"|"
    r"8(?=[\s.\-()\u00a0]+\d)"
    r")"
)

_PHONE_SEP = set(" \t\n\r\u00a0.-()")

_EXT_RE = re.compile(r"\s*(доб\.?|ext\.?|вн\.?|#)\s*\d+", re.IGNORECASE)


def _collect_remaining_digits(text: str, pos: int, need: int) -> str | None:
    """Собирает ровно need цифр начиная с pos, пропуская разделители."""
    digits = []
    i = pos
    last_digit_pos = pos
    max_gap = 5

    while i < len(text) and len(digits) < need:
        ch = text[i]
        if ch.isdigit():
            digits.append(ch)
            last_digit_pos = i
        elif ch in _PHONE_SEP:
            if i - last_digit_pos > max_gap:
                break
        else:
            break
        i += 1

    if len(digits) != need:
        return None
    if i < len(text) and text[i].isdigit():
        return None
    return "".join(digits)


def _normalize_phone(digits: str) -> str | None:
    """Нормализует к 11-значному 7XXXXXXXXXX."""
    if len(digits) < 10 or len(digits) > 11:
        return None
    if len(digits) == 11 and digits[0] == "8":
        digits = "7" + digits[1:]
    elif len(digits) == 10:
        digits = "7" + digits
    elif len(digits) == 11 and digits[0] == "7":
        pass
    else:
        return None
    if not digits.startswith("7"):
        return None
    return digits


def _format_phone(digits: str) -> str:
    return f"+7 ({digits[1:4]}) {digits[4:7]}-{digits[7:9]}-{digits[9:11]}"


def _extract_phones_from_text(text: str) -> list[str]:
    """Посимвольный сбор телефонов (ядро opus.py)."""
    text_clean = _EXT_RE.sub("", text)
    seen = set()
    result = []
    for match in _PHONE_START_RE.finditer(text_clean):
        prefix_digits = re.sub(r"\D", "", match.group(0))
        remaining = _collect_remaining_digits(text_clean, match.end(), 10)
        if remaining is None:
            continue
        digits = prefix_digits + remaining
        normalized = _normalize_phone(digits)
        if normalized and normalized not in seen:
            seen.add(normalized)
            result.append(_format_phone(normalized))
    return result


def _extract_phones_from_hrefs(hrefs: list[str]) -> list[tuple[str, str]]:
    """Извлекает телефоны из tel:-ссылок. Возвращает (digits, formatted)."""
    phones = []
    for href in hrefs:
        if href.lower().startswith("tel:"):
            raw = href[4:].strip()
            digits = re.sub(r"\D", "", raw)
            normalized = _normalize_phone(digits)
            if normalized:
                phones.append((normalized, _format_phone(normalized)))
    return phones


_LOCAL_PHONE_RE = re.compile(
    r"(?<!\d)"
    r"\(\s*(\d{3,5})\s*\)"
    r"[\s\-.]?"
    r"(\d{2,3})"
    r"[\s\-.]?"
    r"(\d{2})"
    r"[\s\-.]?"
    r"(\d{2})"
    r"(?!\d)"
)


def _extract_local_phones(text: str) -> list[str]:
    """Извлекает локальные телефоны вида (495) 737-92-57."""
    text_clean = _EXT_RE.sub("", text)
    result = []
    for match in _LOCAL_PHONE_RE.finditer(text_clean):
        digits = re.sub(r"\D", "", match.group(0))
        normalized = _normalize_phone(digits)
        if normalized:
            result.append(_format_phone(normalized))
    return result


def _extract_telephone_from_jsonld(data, phones: list):
    """Рекурсивно ищет 'telephone' в JSON-LD структуре."""
    if isinstance(data, dict):
        for key, val in data.items():
            if key.lower() == "telephone":
                if isinstance(val, str):
                    phones.append(val)
                elif isinstance(val, list):
                    phones.extend(v for v in val if isinstance(v, str))
            else:
                _extract_telephone_from_jsonld(val, phones)
    elif isinstance(data, list):
        for item in data:
            _extract_telephone_from_jsonld(item, phones)


def _extract_structured_phones(soup: BeautifulSoup, raw_html: str = "") -> list[str]:
    """Извлекает телефоны из JSON-LD, meta, microdata (высокая точность)."""
    phones = []

    # JSON-LD (из оригинального HTML, т.к. soup уже без script)
    if raw_html:
        json_soup = BeautifulSoup(raw_html, "html.parser")
        for script in json_soup.find_all("script", type="application/ld+json"):
            try:
                data = json.loads(script.string or "")
                _extract_telephone_from_jsonld(data, phones)
            except (json.JSONDecodeError, TypeError):
                pass

    # meta property с phone/telephone
    for meta in soup.find_all("meta"):
        prop = meta.get("property", "") or meta.get("name", "")
        if "phone" in prop.lower() or "telephone" in prop.lower():
            content = meta.get("content", "")
            if content:
                phones.append(content)

    # microdata itemprop="telephone"
    for tag in soup.find_all(attrs={"itemprop": "telephone"}):
        text = tag.get("content") or tag.get_text(strip=True)
        if text:
            phones.append(text)

    # Нормализация и дедупликация
    seen = set()
    result = []
    for raw in phones:
        digits = re.sub(r"\D", "", raw)
        normalized = _normalize_phone(digits)
        if normalized and normalized not in seen:
            seen.add(normalized)
            result.append(_format_phone(normalized))
    return result


# ---------------------------------------------------------------------------
# Главная функция
# ---------------------------------------------------------------------------

def extract_contacts(html: str) -> dict:
    """
    Извлекает контакты из HTML-страницы.

    Args:
        html: строка с HTML-содержимым страницы.

    Returns:
        {"emails": [список email lowercase], "phones": [список телефонов "+7 (XXX) XXX-XX-XX"]}
    """
    clean_text, hrefs, soup = _clean_html(html)

    # --- Email ---
    emails_text = _extract_emails_from_text(clean_text)
    emails_href = _extract_emails_from_hrefs(hrefs)
    emails_data = _extract_emails_from_data_attrs(soup)

    all_emails = list(dict.fromkeys(
        e for e in emails_text + emails_href + emails_data
    ))

    # --- Телефоны ---
    phones_text = _extract_phones_from_text(clean_text)
    phones_href = _extract_phones_from_hrefs(hrefs)
    phones_local = _extract_local_phones(clean_text)
    phones_struct = _extract_structured_phones(soup, html)

    seen_digits = set()
    all_phones = []

    # Structured phones — наивысший приоритет (JSON-LD / microdata)
    for phone in phones_struct:
        digits = re.sub(r"\D", "", phone)
        if digits not in seen_digits:
            seen_digits.add(digits)
            all_phones.append(phone)

    # Посимвольный сбор из текста
    for phone in phones_text:
        digits = re.sub(r"\D", "", phone)
        if digits not in seen_digits:
            seen_digits.add(digits)
            all_phones.append(phone)

    # tel:-ссылки
    for digits, formatted in phones_href:
        if digits not in seen_digits:
            seen_digits.add(digits)
            all_phones.append(formatted)

    # Локальные номера (XXX) XXX-XX-XX
    for phone in phones_local:
        digits = re.sub(r"\D", "", phone)
        if digits not in seen_digits:
            seen_digits.add(digits)
            all_phones.append(phone)

    return {"emails": all_emails, "phones": all_phones}
