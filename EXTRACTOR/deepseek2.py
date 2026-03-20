#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
LeadExtractor Core - извлечение контактов (телефоны, email) из HTML-файлов.
Точность > recall, упор на precision.
Обрабатывает локальные файлы в папке /PAGES.

Требуемые библиотеки:
pip install beautifulsoup4 chardet
"""

"""
===============================================
SUMMARY
===============================================
Files processed: 22
Files with contacts: 22
Total phones found: 134
Total emails found: 55
===============================================
"""

import re
import html
import urllib.parse
import sys
from pathlib import Path
from typing import List, Tuple

import chardet
from bs4 import BeautifulSoup

# ============================================================
# Конфигурация
# ============================================================
PAGES_DIR = Path("PAGES")
PHONE_MIN_DIGITS = 10
PHONE_MAX_DIGITS = 11
EMAIL_BLACKLIST_DOMAINS = {".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".bmp", ".tiff", ".webp"}


# ============================================================
# Чтение файла с автоопределением кодировки
# ============================================================
def read_html_file(file_path: Path) -> str:
    """Читает файл, определяет кодировку с помощью chardet."""
    raw = file_path.read_bytes()
    detected = chardet.detect(raw)
    encoding = detected.get('encoding', 'utf-8')
    try:
        return raw.decode(encoding)
    except (UnicodeDecodeError, LookupError):
        # fallback на популярные кодировки
        for enc in ('utf-8', 'cp1251', 'windows-1251', 'latin-1'):
            try:
                return raw.decode(enc)
            except UnicodeDecodeError:
                continue
        # последний шанс
        return raw.decode('utf-8', errors='ignore')


# ============================================================
# Нормализация и фильтрация телефонов
# ============================================================
def normalize_phone(phone_str: str) -> str:
    """Оставляет только цифры."""
    return re.sub(r"\D", "", phone_str)


def is_valid_ru_phone(phone_digits: str, from_attribute: bool = False) -> bool:
    """
    Проверяет, является ли последовательность цифр валидным российским номером.
    :param phone_digits: строка, содержащая только цифры
    :param from_attribute: если True, то номер из атрибута (tel:), там голые цифры допустимы
    :return: True, если номер подходит
    """
    length = len(phone_digits)
    if length not in (PHONE_MIN_DIGITS, PHONE_MAX_DIGITS):
        return False
    # Для 11 цифр первая должна быть 7 или 8 (международный или национальный формат)
    if length == 11 and phone_digits[0] not in ("7", "8"):
        return False
    # Для 10 цифр (редкий случай, когда опущен код страны) – не берём по условию
    # (условие: начинается с +7 или 8). Поэтому 10-значные номера отклоняем.
    if length == 10:
        return False
    return True


# ============================================================
# Извлечение телефонов
# ============================================================
def extract_phones_from_text(text: str) -> List[str]:
    """
    Извлекает телефоны из текста (после очистки от script/style).
    Использует regex, требующий наличие разделителей (кроме начала +7/8).
    """
    pattern = re.compile(
        r'(?:\+7|8)\s*[\(\)\s\-\.]*\d[\d\s\-\.\(\)]{8,}'
    )
    candidates = pattern.findall(text)
    phones = set()
    for cand in candidates:
        # Проверяем, есть ли в кандидате хотя бы один разделитель (кроме цифр и +)
        # Разделители: пробел, скобки, дефис, точка, возможно другие.
        if not re.search(r'[\s\(\)\-\.]', cand):
            # Нет разделителей – голое число, пропускаем (исключение по условию)
            continue
        digits = normalize_phone(cand)
        if is_valid_ru_phone(digits, from_attribute=False):
            phones.add(digits)
    return list(phones)


def extract_phones_from_attributes(soup: BeautifulSoup) -> List[str]:
    """
    Извлекает телефоны из атрибутов href="tel:..."
    """
    phones = set()
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if href.startswith("tel:"):
            tel_part = href[4:]  # после "tel:"
            tel_part = urllib.parse.unquote(tel_part)
            digits = normalize_phone(tel_part)
            if is_valid_ru_phone(digits, from_attribute=True):
                phones.add(digits)
    return list(phones)


def extract_phones(soup: BeautifulSoup, text: str) -> List[str]:
    """
    Комбинирует извлечение из текста и из атрибутов.
    """
    from_text = extract_phones_from_text(text)
    from_attrs = extract_phones_from_attributes(soup)
    all_phones = list(set(from_text + from_attrs))
    return all_phones


# ============================================================
# Извлечение email
# ============================================================
def is_valid_email(email: str) -> bool:
    """
    Фильтрация ложных email: исключаем изображения и слишком короткие.
    """
    domain = email.split('@')[-1].lower()
    for ext in EMAIL_BLACKLIST_DOMAINS:
        if domain.endswith(ext):
            return False
    return True


def extract_emails_from_text(text: str) -> List[str]:
    """
    Стандартный regex для email.
    """
    pattern = re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}')
    emails = set()
    for match in pattern.findall(text):
        if is_valid_email(match):
            emails.add(match.lower())
    return list(emails)


def extract_emails_from_attributes(soup: BeautifulSoup) -> List[str]:
    """
    Извлекает email из атрибутов href="mailto:..."
    """
    emails = set()
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if href.startswith("mailto:"):
            mail_part = href[7:]  # после "mailto:"
            mail_part = urllib.parse.unquote(mail_part)
            if '?' in mail_part:
                mail_part = mail_part.split('?')[0]
            if '@' in mail_part and is_valid_email(mail_part):
                emails.add(mail_part.lower())
    return list(emails)


def extract_emails(soup: BeautifulSoup, text: str) -> List[str]:
    """
    Комбинирует извлечение email из текста и атрибутов.
    """
    from_text = extract_emails_from_text(text)
    from_attrs = extract_emails_from_attributes(soup)
    all_emails = list(set(from_text + from_attrs))
    return all_emails


# ============================================================
# Подготовка HTML
# ============================================================
def clean_html(html_content: str) -> Tuple[BeautifulSoup, str]:
    """
    Принимает сырой HTML, возвращает BeautifulSoup объект и чистый текст.
    Выполняет:
    - декодирование HTML-сущностей (html.unescape)
    - декодирование URL-кодирования (urllib.parse.unquote)
    - удаление тегов <script> и <style>
    - извлечение текста
    """
    # 1. Декодируем HTML-сущности (например, &#64; -> @)
    decoded = html.unescape(html_content)
    # 2. Декодируем процентную кодировку (например, %40 -> @)
    decoded = urllib.parse.unquote(decoded)
    # 3. Создаём суп
    soup = BeautifulSoup(decoded, 'html.parser')
    # 4. Удаляем script и style
    for tag in soup(["script", "style"]):
        tag.decompose()
    # 5. Получаем текст
    text = soup.get_text(separator=" ", strip=True)
    return soup, text


# ============================================================
# Обработка файла
# ============================================================
def process_file(file_path: Path):
    """
    Обрабатывает один HTML-файл и выводит результат.
    Возвращает (phones, emails) для статистики.
    """
    try:
        raw_html = read_html_file(file_path)
    except Exception as e:
        print(f"Ошибка чтения {file_path}: {e}")
        return [], []

    soup, text = clean_html(raw_html)

    phones = extract_phones(soup, text)
    emails = extract_emails(soup, text)

    # Вывод
    print("-" * 35)
    print(f"FILE: {file_path.name}")
    print("PHONES:")
    for phone in phones:
        print(phone)
    print("EMAILS:")
    for email in emails:
        print(email)
    print("-" * 35)

    return phones, emails


# ============================================================
# Главная функция
# ============================================================
def main():
    # Устанавливаем кодировку вывода для корректного отображения Unicode
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    else:
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

    if not PAGES_DIR.exists():
        print(f"Папка {PAGES_DIR} не найдена.")
        return

    html_files = list(PAGES_DIR.glob("*.html"))
    if not html_files:
        print(f"Нет файлов .html в {PAGES_DIR}.")
        return

    # Статистика
    total_files = len(html_files)
    files_with_contacts = 0
    total_phones = 0
    total_emails = 0

    for html_file in sorted(html_files):
        phones, emails = process_file(html_file)
        if phones or emails:
            files_with_contacts += 1
        total_phones += len(phones)
        total_emails += len(emails)

    # Вывод статистики
    print("\n" + "=" * 47)
    print("SUMMARY")
    print("=" * 47)
    print(f"Files processed: {total_files}")
    print(f"Files with contacts: {files_with_contacts}")
    print(f"Total phones found: {total_phones}")
    print(f"Total emails found: {total_emails}")
    print("=" * 47)


if __name__ == "__main__":
    main()