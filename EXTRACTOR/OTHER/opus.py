#!/usr/bin/env python3
"""
LeadExtractor — Baseline HTML Contact Extractor
Извлекает телефоны (РФ) и email из локальных HTML-файлов.

Архитектура спроектирована слоями для расширяемости:
1. Очистка HTML (clean_html)
2. Извлечение кандидатов (regex)
3. Нормализация и фильтрация
4. Дедупликация

Известные ограничения (future improvements):
- Обфускация email: info [at] example [dot] com — не обрабатывается
- JS-генерация контактов: document.write("info@" + "example.com") — игнорируется
- Кириллические домены (IDN): info@пример.рф — не обрабатывается
"""

"""
Итого: 22 файлов, 132 телефонов, 55 email

SUMMARY
-----------------------------------
Files processed: 22
Files with contacts: 22
Total phones found: 132
Total emails found: 55
-----------------------------------
"""

import os
import re
import html
import glob
import sys
from urllib.parse import unquote

from bs4 import BeautifulSoup

# ---------------------------------------------------------------------------
# Конфигурация
# ---------------------------------------------------------------------------

PAGES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "PAGES")

# Расширения изображений и ресурсов — ложные «домены» для email
FAKE_EMAIL_EXTENSIONS = {
    "png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "bmp", "tiff",
    "js", "css", "woff", "woff2", "ttf", "eot", "map", "json", "xml",
}

# Допустимые TLD верхнего уровня (базовый набор).
# Расширяй по необходимости.
VALID_TLDS = {
    "ru", "com", "net", "org", "info", "biz", "рф", "su",
    "pro", "me", "io", "co", "uk", "de", "fr", "by", "ua", "kz",
    "edu", "gov", "mil", "int", "name", "travel", "museum",
}

# ---------------------------------------------------------------------------
# Очистка HTML
# ---------------------------------------------------------------------------

def clean_html(raw_html: str) -> tuple[str, list[str]]:
    """
    Очищает HTML и возвращает (чистый_текст, список_href_атрибутов).

    Этапы:
    1. URL-декодирование (%40 → @, %2B → + и т.д.)
    2. HTML-entity декодирование (&#64; → @, &amp; → &)
    3. Замена &nbsp; на пробел
    4. Удаление <script> и <style> (через BeautifulSoup)
    5. Извлечение href-атрибутов (mailto:, tel:)
    6. Получение чистого текста через get_text()
       — решает проблему разбитых номеров в <span>

    EDGE CASE #12: Сильный шум (JSON, inline CSS, мусор) — частично
    решается удалением <script>/<style>. Полная очистка требует
    дополнительных эвристик.
    """
    # Шаг 1: URL-декодирование (EDGE CASE #1)
    text = unquote(raw_html)

    # Шаг 2: HTML-entity декодирование (EDGE CASE #2)
    text = html.unescape(text)

    # Шаг 3: &nbsp; → пробел (EDGE CASE #6)
    # После unescape &nbsp; превращается в \xa0
    text = text.replace("\xa0", " ")

    # Шаг 4-6: BeautifulSoup
    soup = BeautifulSoup(text, "html.parser")

    # Удаляем <script> и <style> (EDGE CASE #4: JS-генерация игнорируется)
    for tag in soup.find_all(["script", "style"]):
        tag.decompose()

    # Извлекаем href-атрибуты (EDGE CASE #10)
    hrefs = []
    for a_tag in soup.find_all("a", href=True):
        href = a_tag["href"]
        # Декодируем href отдельно — может содержать percent-encoding
        href = html.unescape(unquote(href))
        hrefs.append(href)

    # EDGE CASE #5, #16: Номер разбит по <span> — get_text() склеит
    # Разделитель " " чтобы <span>+7</span><span>985</span> стало "+7 985"
    clean_text = soup.get_text(separator=" ")

    # Нормализуем пробельные символы
    clean_text = re.sub(r"\s+", " ", clean_text)

    return clean_text, hrefs


# ---------------------------------------------------------------------------
# Извлечение email
# ---------------------------------------------------------------------------

# Основной regex для email
# EDGE CASE #9: Ложные email (image@2x.png) фильтруются отдельно
# EDGE CASE #11: Кириллические домены — не поддерживаются на данном этапе
_EMAIL_RE = re.compile(
    r"[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}",
    re.IGNORECASE,
)


def _is_valid_email(email: str) -> bool:
    """Фильтрует ложные email по расширению и TLD."""
    # Извлекаем TLD
    tld = email.rsplit(".", 1)[-1].lower()

    # EDGE CASE #9: image@2x.png, icon@3x.svg
    if tld in FAKE_EMAIL_EXTENSIONS:
        return False

    # Проверяем допустимый TLD (можно отключить для широкого покрытия)
    if VALID_TLDS and tld not in VALID_TLDS:
        return False

    return True


def extract_emails(text: str) -> list[str]:
    """
    Извлекает уникальные email-адреса из текста.

    EDGE CASE #3: Обфускация (info [at] example [dot] com) —
    не обрабатывается. Требуется отдельный слой нормализации.
    """
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
            addr = href[7:].split("?")[0].strip()  # убираем ?subject=...
            if _EMAIL_RE.fullmatch(addr) and _is_valid_email(addr.lower()):
                emails.append(addr)
    return emails


# ---------------------------------------------------------------------------
# Извлечение телефонов
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Стратегия извлечения телефонов:
# 1. Находим начало номера: "+7" или "8" с разделителем
# 2. От начала собираем цифры с разделителями, пока не наберём 10-11 цифр
# 3. Нормализуем и фильтруем
#
# EDGE CASE #15: Другие коды стран — добавлять новые паттерны начала
# (например, +380 для Украины).
# ---------------------------------------------------------------------------

# Паттерн начала номера
# +7 — всегда валидное начало
# 8 — только если после неё идёт разделитель (не голая 8XXXXXXXXXX)
_PHONE_START_RE = re.compile(
    r"(?<!\d)"          # не предшествует цифра
    r"(?:"
    r"\+\s*7"           # +7
    r"|"
    r"8(?=[\s.\-()\u00a0]+\d)"  # 8 с разделителем перед цифрой
    r")"
)

# Символы-разделители внутри номера
_PHONE_SEP = set(" \t\n\r\u00a0.-()")

# EDGE CASE #7: добавочный номер — обрезаем
_EXT_RE = re.compile(r"\s*(доб\.?|ext\.?|вн\.?|#)\s*\d+", re.IGNORECASE)


def _collect_remaining_digits(text: str, pos: int, need: int) -> str | None:
    """
    Начиная с позиции pos, собирает ровно need цифр (пропуская разделители).
    Возвращает строку из цифр или None если не удалось набрать.

    Останавливается когда:
    - набрано need цифр, или
    - встретился символ не из (цифра, разделитель), или
    - слишком большой промежуток без цифр (> max_gap символов)
    """
    digits = []
    i = pos
    last_digit_pos = pos
    max_gap = 5  # максимальный промежуток без цифр

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

    # EDGE CASE #13: проверяем что сразу после номера нет цифры
    if i < len(text) and text[i].isdigit():
        return None

    return "".join(digits)


def _normalize_phone(digits: str) -> str | None:
    """
    Нормализует строку цифр к 11-значному номеру 7XXXXXXXXXX.

    EDGE CASE #8: Дубликаты — нормализация позволяет их обнаружить.
    EDGE CASE #13, #14: Фильтр по длине.
    """
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
    """Форматирует 11-значный номер в читаемый вид: +7 (XXX) XXX-XX-XX"""
    return f"+7 ({digits[1:4]}) {digits[4:7]}-{digits[7:9]}-{digits[9:11]}"


def extract_phones(text: str) -> list[str]:
    """
    Извлекает уникальные телефоны РФ из текста.

    Стратегия:
    1. Убираем добавочные номера (EDGE CASE #7)
    2. Находим все начала номеров через regex
    3. От каждого начала собираем цифры посимвольно
    4. Нормализуем и дедуплицируем (EDGE CASE #8)
    """
    # EDGE CASE #7: убираем добавочные номера до поиска
    text_clean = _EXT_RE.sub("", text)

    seen = set()
    result = []

    for match in _PHONE_START_RE.finditer(text_clean):
        # Извлекаем цифру из префикса (7 из +7, или 8)
        prefix_digits = re.sub(r"\D", "", match.group(0))  # "7" или "8"

        # Собираем оставшиеся 10 цифр после префикса
        remaining = _collect_remaining_digits(text_clean, match.end(), 10)
        if remaining is None:
            continue

        digits = prefix_digits + remaining  # 11 цифр
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
# Обработка файла
# ---------------------------------------------------------------------------

def process_file(filepath: str) -> dict:
    """
    Обрабатывает один HTML-файл.
    Возвращает dict с ключами: file, phones, emails.
    """
    with open(filepath, "r", encoding="utf-8", errors="replace") as f:
        raw_html = f.read()

    clean_text, hrefs = clean_html(raw_html)

    # Email: из текста + из href
    emails_text = extract_emails(clean_text)
    emails_href = extract_emails_from_hrefs(hrefs)
    all_emails = list(dict.fromkeys(
        e.lower() for e in emails_text + emails_href
    ))

    # Телефоны: из текста + из href
    phones_text = extract_phones(clean_text)
    phones_href = extract_phones_from_hrefs(hrefs)

    # Дедупликация по нормализованной форме
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

    return {
        "file": os.path.basename(filepath),
        "phones": all_phones,
        "emails": all_emails,
    }


# ---------------------------------------------------------------------------
# Главная функция
# ---------------------------------------------------------------------------

def main():
    # Устанавливаем кодировку вывода для корректного отображения Unicode
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    else:
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

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
