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
import json
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
# Pipeline v2 — ШАГ 1: Загрузка кодов телефонов
# ---------------------------------------------------------------------------

_PHONE_CODES_CACHE: set[str] | None = None

_FALLBACK_CODES = {
    "495", "499", "812", "800",
    "343", "383", "831", "846", "863",
    "351", "861", "843", "845",
}


def load_phone_codes() -> set[str]:
    """Загружает коды из codes.txt рядом с extractor_final.py. Кэширует."""
    global _PHONE_CODES_CACHE
    if _PHONE_CODES_CACHE is not None:
        return _PHONE_CODES_CACHE

    codes_path = os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "codes.txt"
    )
    if os.path.isfile(codes_path):
        codes = set()
        with open(codes_path, encoding="utf-8") as f:
            for line in f:
                code = line.strip()
                if code:
                    codes.add(code)
        _PHONE_CODES_CACHE = codes if codes else _FALLBACK_CODES
    else:
        _PHONE_CODES_CACHE = _FALLBACK_CODES

    return _PHONE_CODES_CACHE


# ---------------------------------------------------------------------------
# Pipeline v2 — ШАГ 2: RAW CANDIDATES
# ---------------------------------------------------------------------------

_CANDIDATE_RE = re.compile(r"[\+\d][\d\-\(\)\s]{5,}")


def extract_phone_candidates(text: str) -> list[tuple[str, int, int]]:
    """Находит все возможные телефонные паттерны в тексте."""
    results = []
    for m in _CANDIDATE_RE.finditer(text):
        results.append((m.group(0), m.start(), m.end()))
    return results


# ---------------------------------------------------------------------------
# Pipeline v2 — ШАГ 3: NORMALIZATION
# ---------------------------------------------------------------------------

def normalize_candidate(raw: str) -> str | None:
    """Нормализует сырой кандидат к 7XXXXXXXXXX или None."""
    digits = re.sub(r"\D", "", raw)
    if len(digits) == 10:
        return "7" + digits
    if len(digits) == 11:
        if digits[0] in ("7", "8"):
            return "7" + digits[1:]
    return None


# ---------------------------------------------------------------------------
# Pipeline v2 — ШАГ 4: CONTEXT
# ---------------------------------------------------------------------------

def extract_context(text: str, start: int, end: int, window: int = 50) -> str:
    """Извлекает контекст ±window символов вокруг найденного кандидата."""
    ctx_start = max(0, start - window)
    ctx_end = min(len(text), end + window)
    return text[ctx_start:ctx_end]


# ---------------------------------------------------------------------------
# Pipeline v2 — ШАГ 5: SCORING (расширенный)
# ---------------------------------------------------------------------------

_POSITIVE_CONTEXT_WORDS = ["тел", "phone", "call", "contact", "связ", "звон"]
_NEGATIVE_INN = ["инн", "огрн", "кпп"]
_NEGATIVE_BANK = ["счет", "расчетный", "банк"]
_NEGATIVE_ORDER = ["заказ", "order", "артикул", "код товара"]


def score_phone(digits: str, context: str, raw: str, codes: set[str]) -> int:
    """Рассчитывает score кандидата телефона."""
    score = 0
    ctx = context.lower()
    raw_lower = raw.lower()

    # --- POSITIVE ---
    if "tel:" in raw_lower or "tel:" in ctx:
        score += 5

    if any(w in ctx for w in _POSITIVE_CONTEXT_WORDS):
        score += 4

    # мобильный код (9XX)
    if len(digits) >= 4 and digits[1] == "9":
        score += 3

    # код города в codes.txt
    if len(digits) >= 4 and digits[1:4] in codes:
        score += 2

    # структурированный формат (скобки, дефисы)
    if "(" in raw or "-" in raw:
        score += 2

    # --- NEGATIVE ---
    if any(w in ctx for w in _NEGATIVE_INN):
        score -= 5

    if any(w in ctx for w in _NEGATIVE_BANK):
        score -= 4

    if any(w in ctx for w in _NEGATIVE_ORDER):
        score -= 3

    # --- FALLBACK ---
    has_context = any(w in ctx for w in _POSITIVE_CONTEXT_WORDS) or "tel:" in ctx
    has_code = (len(digits) >= 4 and
                (digits[1] == "9" or digits[1:4] in codes))
    if not has_context and not has_code:
        score -= 2

    return score


# ---------------------------------------------------------------------------
# Pipeline v2 — ШАГ 6: STRUCTURED DATA
# ---------------------------------------------------------------------------

def extract_structured_phones(soup: BeautifulSoup) -> list[str]:
    """Извлекает телефоны из JSON-LD, meta, microdata (high-confidence)."""
    phones = []

    # 1. JSON-LD
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
            _extract_telephone_from_jsonld(data, phones)
        except (json.JSONDecodeError, TypeError):
            pass

    # 2. meta property="og:phone" или подобное
    for meta in soup.find_all("meta"):
        prop = meta.get("property", "") or meta.get("name", "")
        if "phone" in prop.lower() or "telephone" in prop.lower():
            content = meta.get("content", "")
            if content:
                phones.append(content)

    # 3. microdata itemprop="telephone"
    for tag in soup.find_all(attrs={"itemprop": "telephone"}):
        text = tag.get("content") or tag.get_text(strip=True)
        if text:
            phones.append(text)

    # Нормализация и dedup
    seen = set()
    result = []
    for raw in phones:
        normalized = normalize_candidate(raw)
        if normalized and normalized not in seen:
            seen.add(normalized)
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


# ---------------------------------------------------------------------------
# Pipeline v2 — ШАГ 7: ОСНОВНОЙ PIPELINE
# ---------------------------------------------------------------------------

def extract_phones_v2(text: str, soup: BeautifulSoup) -> list[str]:
    """Новый pipeline: candidates → normalize → context → score → filter."""
    codes = load_phone_codes()
    candidates = extract_phone_candidates(text)

    seen = set()
    result = []
    threshold = 2

    for raw, start, end in candidates:
        normalized = normalize_candidate(raw)
        if normalized is None:
            continue

        context = extract_context(text, start, end)
        sc = score_phone(normalized, context, raw, codes)

        if sc >= threshold and normalized not in seen:
            seen.add(normalized)
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

    # Телефоны: текст + href + локальные + v2 pipeline + structured
    phones_text = extract_phones(clean_text)
    phones_href = extract_phones_from_hrefs(hrefs)
    phones_local = extract_local_phones(clean_text)
    phones_v2 = extract_phones_v2(clean_text, soup)
    phones_struct = extract_structured_phones(soup)

    seen_digits = set()
    all_phones = []
    # structured phones — высший приоритет (high-confidence)
    for phone in phones_struct:
        digits = re.sub(r"\D", "", phone)
        if digits not in seen_digits:
            seen_digits.add(digits)
            all_phones.append(phone)
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
    for phone in phones_v2:
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
