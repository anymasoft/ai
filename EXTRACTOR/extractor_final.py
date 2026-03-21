#!/usr/bin/env python3
"""
LeadExtractor — Финальный HTML Contact Extractor
База: opus.py (посимвольный сбор телефонов)
Добавлено из deepseek2.py: chardet кодировки
Добавлено из qwen.py: data-* атрибуты, email stop-паттерны
"""

import os
import re
import html
import glob
import sys
from urllib.parse import unquote

from bs4 import BeautifulSoup, Comment

try:
    import chardet
except ImportError:
    chardet = None

# ---------------------------------------------------------------------------
# Конфигурация
# ---------------------------------------------------------------------------

PAGES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "PAGES")

FAKE_EMAIL_EXTENSIONS = {
    "png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "bmp", "tiff",
    "js", "css", "woff", "woff2", "ttf", "eot", "map", "json", "xml",
}

VALID_TLDS = {
    "ru", "com", "net", "org", "info", "biz", "рф", "su",
    "pro", "me", "io", "co", "uk", "de", "fr", "by", "ua", "kz",
    "edu", "gov", "mil", "int", "name", "travel", "museum",
}

# Из qwen.py: паттерны мусорных email
EMAIL_STOP_PATTERNS = [
    re.compile(r"image@\d+x", re.IGNORECASE),
    re.compile(r"icon@\d+x", re.IGNORECASE),
    re.compile(r"@\d+x\.", re.IGNORECASE),
    re.compile(r"example\.com$", re.IGNORECASE),
    re.compile(r"^test@", re.IGNORECASE),
    re.compile(r"^demo@", re.IGNORECASE),
    re.compile(r"^sample@", re.IGNORECASE),
]


# ---------------------------------------------------------------------------
# Чтение файла с автоопределением кодировки (из deepseek2.py)
# ---------------------------------------------------------------------------

def read_html_file(filepath: str) -> str:
    """Читает HTML-файл с автоопределением кодировки через chardet + fallback."""
    raw = open(filepath, "rb").read()

    if chardet:
        detected = chardet.detect(raw)
        encoding = detected.get("encoding", "utf-8")
        try:
            return raw.decode(encoding)
        except (UnicodeDecodeError, LookupError):
            pass

    for enc in ("utf-8", "utf-8-sig", "cp1251", "windows-1251", "iso-8859-5", "latin-1"):
        try:
            return raw.decode(enc)
        except UnicodeDecodeError:
            continue

    return raw.decode("utf-8", errors="replace")


# ---------------------------------------------------------------------------
# Очистка HTML
# ---------------------------------------------------------------------------

def clean_html(raw_html: str) -> tuple[str, list[str], BeautifulSoup]:
    """
    Очищает HTML и возвращает (чистый_текст, список_href, soup).

    1. URL-декодирование
    2. HTML-entity декодирование
    3. &nbsp; → пробел
    4. Удаление <script>, <style>, <noscript>, комментариев
    5. Извлечение href-атрибутов (mailto:, tel:)
    6. get_text() с separator=" "
    """
    text = unquote(raw_html)
    text = html.unescape(text)
    text = text.replace("\xa0", " ")

    soup = BeautifulSoup(text, "html.parser")

    for tag in soup.find_all(["script", "style", "noscript"]):
        tag.decompose()

    for comment in soup.find_all(string=lambda t: isinstance(t, Comment)):
        comment.extract()

    hrefs = []
    for a_tag in soup.find_all("a", href=True):
        href = a_tag["href"]
        href = html.unescape(unquote(href))
        hrefs.append(href)

    clean_text = soup.get_text(separator=" ")
    clean_text = re.sub(r"\s+", " ", clean_text)

    return clean_text, hrefs, soup


# ---------------------------------------------------------------------------
# Извлечение email
# ---------------------------------------------------------------------------

_EMAIL_RE = re.compile(
    r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}",
    re.IGNORECASE,
)


def _is_valid_email(email: str) -> bool:
    """Фильтрует ложные email."""
    tld = email.rsplit(".", 1)[-1].lower()

    if tld in FAKE_EMAIL_EXTENSIONS:
        return False

    if VALID_TLDS and tld not in VALID_TLDS:
        return False

    # Из qwen.py: stop-паттерны
    for pattern in EMAIL_STOP_PATTERNS:
        if pattern.search(email):
            return False

    return True


def extract_emails(text: str) -> list[str]:
    """Извлекает уникальные email из текста."""
    candidates = _EMAIL_RE.findall(text)
    seen = set()
    result = []
    for email in candidates:
        normalized = email.lower()
        if normalized not in seen and _is_valid_email(normalized):
            seen.add(normalized)
            result.append(email)
    return result


def extract_emails_from_hrefs(hrefs: list[str]) -> list[str]:
    """Извлекает email из mailto:-ссылок."""
    emails = []
    for href in hrefs:
        if href.lower().startswith("mailto:"):
            addr = href[7:].split("?")[0].strip()
            if _EMAIL_RE.fullmatch(addr) and _is_valid_email(addr.lower()):
                emails.append(addr)
    return emails


def extract_emails_from_data_attrs(soup: BeautifulSoup) -> list[str]:
    """Из qwen.py: извлекает email из data-* атрибутов."""
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
                    if match and _is_valid_email(match.group(0).lower()):
                        emails.append(match.group(0))
    return emails


# ---------------------------------------------------------------------------
# Извлечение телефонов (ядро из opus.py — без изменений)
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

    if len(digits) == 11 and digits.startswith("8"):
        digits = "7" + digits[1:]
    elif len(digits) == 10:
        digits = "7" + digits
    elif len(digits) == 11 and digits.startswith("7"):
        pass
    else:
        return None

    if not digits.startswith("7"):
        return None

    return digits


def _format_phone(digits: str) -> str:
    """Форматирует: +7 (XXX) XXX-XX-XX"""
    return f"+7 ({digits[1:4]}) {digits[4:7]}-{digits[7:9]}-{digits[9:11]}"


def extract_phones(text: str) -> list[str]:
    """Извлекает телефоны посимвольным сбором (ядро opus.py)."""
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


def extract_phones_from_hrefs(hrefs: list[str]) -> list[str]:
    """Извлекает телефоны из tel:-ссылок."""
    phones = []
    for href in hrefs:
        if href.lower().startswith("tel:"):
            raw = href[4:].strip()
            digits = re.sub(r"\D", "", raw)
            normalized = _normalize_phone(digits)
            if normalized:
                phones.append((normalized, _format_phone(normalized)))
    return phones


# ---------------------------------------------------------------------------
# Извлечение локальных телефонов (без +7/8 префикса)
# ---------------------------------------------------------------------------

_LOCAL_PHONE_RE = re.compile(
    r"(?<!\d)"
    r"\(\s*(\d{3,5})\s*\)"       # код города в скобках: (495), (812), (34567)
    r"[\s\-.]?"
    r"(\d{2,3})"                  # первая группа цифр
    r"[\s\-.]?"
    r"(\d{2})"                    # вторая
    r"[\s\-.]?"
    r"(\d{2})"                    # третья
    r"(?!\d)"
)


def extract_local_phones(text: str) -> list[str]:
    """Извлекает локальные телефоны вида (495) 737-92-57 без +7/8."""
    text_clean = _EXT_RE.sub("", text)
    result = []

    for match in _LOCAL_PHONE_RE.finditer(text_clean):
        digits = re.sub(r"\D", "", match.group(0))
        if len(digits) == 10:
            normalized = _normalize_phone(digits)
            if normalized:
                result.append(_format_phone(normalized))
        elif len(digits) == 11:
            normalized = _normalize_phone(digits)
            if normalized:
                result.append(_format_phone(normalized))

    return result


# ---------------------------------------------------------------------------
# Обработка файла
# ---------------------------------------------------------------------------

def process_file(filepath: str) -> dict:
    """Обрабатывает один HTML-файл."""
    raw_html = read_html_file(filepath)
    clean_text, hrefs, soup = clean_html(raw_html)

    # Email: текст + href + data-*
    emails_text = extract_emails(clean_text)
    emails_href = extract_emails_from_hrefs(hrefs)
    emails_data = extract_emails_from_data_attrs(soup)
    all_emails = list(dict.fromkeys(
        e.lower() for e in emails_text + emails_href + emails_data
    ))

    # Телефоны: текст + href + локальные
    phones_text = extract_phones(clean_text)
    phones_href = extract_phones_from_hrefs(hrefs)
    phones_local = extract_local_phones(clean_text)

    seen_digits = set()
    all_phones = []
    for phone in phones_text:
        digits = re.sub(r"\D", "", phone)
        if digits not in seen_digits:
            seen_digits.add(digits)
            all_phones.append(phone)
    for digits, formatted in phones_href:
        if digits not in seen_digits:
            seen_digits.add(digits)
            all_phones.append(formatted)
    for phone in phones_local:
        digits = re.sub(r"\D", "", phone)
        if digits not in seen_digits:
            seen_digits.add(digits)
            all_phones.append(phone)

    return {
        "file": os.path.basename(filepath),
        "phones": all_phones,
        "emails": all_emails,
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    else:
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

    pages_dir = PAGES_DIR
    if len(sys.argv) > 1:
        pages_dir = sys.argv[1]

    if not os.path.isdir(pages_dir):
        print(f"Папка не найдена: {pages_dir}")
        sys.exit(1)

    html_files = sorted(glob.glob(os.path.join(pages_dir, "*.html")))

    if not html_files:
        print(f"HTML-файлы не найдены в: {pages_dir}")
        sys.exit(1)

    total_phones = 0
    total_emails = 0
    files_with_contacts = 0

    for filepath in html_files:
        result = process_file(filepath)

        print("-----------------------------------")
        print(f"FILE: {result['file']}")
        print("PHONES:")
        if result["phones"]:
            for phone in result["phones"]:
                print(f"  {phone}")
        else:
            print("  (не найдено)")
        print("EMAILS:")
        if result["emails"]:
            for email in result["emails"]:
                print(f"  {email}")
        else:
            print("  (не найдено)")
        print("-----------------------------------")
        print()

        total_phones += len(result["phones"])
        total_emails += len(result["emails"])
        if result["phones"] or result["emails"]:
            files_with_contacts += 1

    print(f"Итого: {len(html_files)} файлов, "
          f"{total_phones} телефонов, {total_emails} email")
    print()
    print("SUMMARY")
    print("-----------------------------------")
    print(f"Files processed: {len(html_files)}")
    print(f"Files with contacts: {files_with_contacts}")
    print(f"Total phones found: {total_phones}")
    print(f"Total emails found: {total_emails}")
    print("-----------------------------------")


if __name__ == "__main__":
    main()
