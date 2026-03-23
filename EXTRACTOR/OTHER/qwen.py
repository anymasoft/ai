#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LeadExtractor — Core HTML Contact Extraction Module
Version: 1.0.1 (FIXED)

Исправления в этой версии:
- Fixed: Ошибка 'str' object has no attribute 'keys' при парсинге атрибутов
- Fixed: Обработка attr_value который может быть list вместо str
- Added: Более безопасная проверка типов перед итерацией
"""

"""
============================================================
SUMMARY
============================================================
Files processed: 22
Files with contacts: 21
Total phones found: 110
Total emails found: 55
============================================================
"""

import os
import re
import html
import sys
from pathlib import Path
from typing import Set, List
from urllib.parse import unquote
from bs4 import BeautifulSoup


# =============================================================================
# КОНФИГУРАЦИЯ
# =============================================================================

SUPPORTED_COUNTRY_CODES = ['+7', '8']
PHONE_MIN_DIGITS = 10
PHONE_MAX_DIGITS = 11

VALID_EMAIL_TLDS = {
    '.ru', '.com', '.org', '.net', '.io', '.co', '.biz', '.info',
    '.rf', '.рф', '.su', '.ua', '.kz', '.by', '.eu', '.uk', '.de',
    '.fr', '.es', '.it', '.nl', '.pl', '.cn', '.jp', '.au', '.ca'
}

EMAIL_STOP_PATTERNS = [
    r'image@\d+x',
    r'icon@\d+x',
    r'@\d+x\.',
    r'example\.com',
    r'test@',
    r'demo@',
    r'sample@',
]

PAGES_DIR = Path('./PAGES')


# =============================================================================
# ФУНКЦИЯ 1: ОЧИСТКА HTML
# =============================================================================

def clean_html(raw_html: str) -> str:
    """
    Очищает HTML от script, style, noscript, комментариев.
    """
    try:
        soup = BeautifulSoup(raw_html, 'html.parser')

        for tag in soup(['script', 'style', 'noscript']):
            tag.decompose()

        for comment in soup.find_all(string=lambda text: isinstance(text, str) and text.strip().startswith('<!--')):
            comment.extract()

        return str(soup)

    except Exception as e:
        print(f"[WARN] HTML parse error: {e}")
        return raw_html


# =============================================================================
# ФУНКЦИЯ 2: ПРЕДВАРИТЕЛЬНАЯ ОБРАБОТКА ТЕКСТА
# =============================================================================

def preprocess_text(text: str) -> str:
    """
    URL decoding, HTML entities, нормализация пробелов.
    """
    if not text:
        return ""

    try:
        text = unquote(text)
    except Exception:
        pass

    text = html.unescape(text)
    text = text.replace('&nbsp;', ' ')
    text = text.replace('\xa0', ' ')
    text = text.replace('\u2007', ' ')
    text = text.replace('\u202f', ' ')
    text = re.sub(r'\s+', ' ', text)

    return text.strip()


# =============================================================================
# ФУНКЦИЯ 3: ИЗВЛЕЧЕНИЕ EMAIL
# =============================================================================

def extract_emails(text: str, soup: BeautifulSoup = None) -> Set[str]:
    """
    Извлекает email из текста и HTML-атрибутов.

    FIX v1.0.1:
    - Передаём готовый soup объект вместо строки
    - Добавлена проверка типов перед итерацией атрибутов
    - Обработка attr_value который может быть list
    """
    emails: Set[str] = set()

    # -------------------------------------------------------------------------
    # ШАГ 1: Извлечение из текста
    # -------------------------------------------------------------------------

    email_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
    found_emails = re.findall(email_pattern, text)

    for email in found_emails:
        email = email.lower().strip()
        if _is_valid_email(email):
            emails.add(email)

    # -------------------------------------------------------------------------
    # ШАГ 2: Извлечение из HTML-атрибутов (FIXED)
    # -------------------------------------------------------------------------

    if soup is not None:
        try:
            # Ищем все <a> теги с href
            for link in soup.find_all('a', href=True):
                href = link.get('href')

                # FIX: Проверяем что href это строка
                if not isinstance(href, str):
                    continue

                # Обработка mailto:
                if href.startswith('mailto:'):
                    email = href[7:].strip()
                    email = unquote(email)
                    email = html.unescape(email)
                    email = email.split('?')[0].strip()

                    if _is_valid_email(email):
                        emails.add(email.lower())

                # Email просто в href
                elif '@' in href and '.' in href:
                    match = re.search(email_pattern, href)
                    if match:
                        email = match.group(0).lower()
                        if _is_valid_email(email):
                            emails.add(email)

            # Ищем в data-* атрибутах (FIXED)
            # Проблема была здесь: attrs может содержать list вместо str
            for tag in soup.find_all():
                # FIX: Проверяем что attrs существует и это dict
                attrs = getattr(tag, 'attrs', None)

                if not isinstance(attrs, dict):
                    continue

                # Проверяем есть ли data-* атрибуты
                has_data_attr = any(
                    isinstance(key, str) and key.startswith('data-')
                    for key in attrs.keys()
                )

                if not has_data_attr:
                    continue

                # Итерируем атрибуты
                for attr_name, attr_value in attrs.items():
                    # FIX: attr_value может быть строкой ИЛИ списком
                    if isinstance(attr_value, list):
                        # Если список, обрабатываем каждый элемент
                        for value_item in attr_value:
                            if isinstance(value_item, str) and '@' in value_item:
                                match = re.search(email_pattern, value_item)
                                if match:
                                    email = match.group(0).lower()
                                    if _is_valid_email(email):
                                        emails.add(email)

                    elif isinstance(attr_value, str):
                        # Если строка, обрабатываем напрямую
                        if '@' in attr_value:
                            match = re.search(email_pattern, attr_value)
                            if match:
                                email = match.group(0).lower()
                                if _is_valid_email(email):
                                    emails.add(email)

        except Exception as e:
            print(f"[WARN] Error parsing HTML attributes for emails: {e}")

    return emails


def _is_valid_email(email: str) -> bool:
    """Валидация email."""
    if not email:
        return False

    for pattern in EMAIL_STOP_PATTERNS:
        if re.search(pattern, email, re.IGNORECASE):
            return False

    tld_pattern = r'\.([a-zA-Z]{2,})$'
    match = re.search(tld_pattern, email)

    if match:
        tld = '.' + match.group(1).lower()
        file_extensions = {'.png', '.svg', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.css', '.js'}
        if tld in file_extensions:
            return False

    if len(email) > 254:
        return False

    if '@' not in email or '.' not in email.split('@')[-1]:
        return False

    return True


# =============================================================================
# ФУНКЦИЯ 4: ИЗВЛЕЧЕНИЕ ТЕЛЕФОНОВ
# =============================================================================

def extract_phones(text: str, soup: BeautifulSoup = None) -> Set[str]:
    """
    Извлекает телефоны из текста и HTML-атрибутов.

    FIX v1.0.1:
    - Передаём готовый soup объект вместо строки
    - Добавлена проверка типов перед итерацией атрибутов
    - Обработка attr_value который может быть list
    """
    phones: Set[str] = set()

    # -------------------------------------------------------------------------
    # ШАГ 1: Извлечение кандидатов из текста
    # -------------------------------------------------------------------------

    phone_pattern = r'''
        (?:
            (?:\+7|8)
            [.\s\-()]?
            \(?\d{3}\)?
            [.\s\-()]*
            \d{3}
            [.\s\-()]*
            \d{2}
            [.\s\-()]*
            \d{2}
        )
    '''

    found_phones = re.findall(phone_pattern, text, re.VERBOSE)

    for phone_candidate in found_phones:
        normalized = _normalize_phone(phone_candidate)
        if normalized:
            phones.add(normalized)

    # -------------------------------------------------------------------------
    # ШАГ 2: Извлечение из HTML-атрибутов (FIXED)
    # -------------------------------------------------------------------------

    if soup is not None:
        try:
            # Ищем <a> теги с href="tel:..."
            for link in soup.find_all('a', href=True):
                href = link.get('href')

                # FIX: Проверяем что href это строка
                if not isinstance(href, str):
                    continue

                if href.startswith('tel:'):
                    phone = href[4:].strip()
                    phone = unquote(phone)
                    phone = html.unescape(phone)

                    normalized = _normalize_phone(phone)
                    if normalized:
                        phones.add(normalized)

            # Ищем в data-* атрибутах (FIXED)
            for tag in soup.find_all():
                attrs = getattr(tag, 'attrs', None)

                if not isinstance(attrs, dict):
                    continue

                has_data_attr = any(
                    isinstance(key, str) and key.startswith('data-')
                    for key in attrs.keys()
                )

                if not has_data_attr:
                    continue

                for attr_name, attr_value in attrs.items():
                    if isinstance(attr_value, list):
                        for value_item in attr_value:
                            if isinstance(value_item, str):
                                match = re.search(phone_pattern, value_item, re.VERBOSE)
                                if match:
                                    normalized = _normalize_phone(match.group(0))
                                    if normalized:
                                        phones.add(normalized)

                    elif isinstance(attr_value, str):
                        match = re.search(phone_pattern, attr_value, re.VERBOSE)
                        if match:
                            normalized = _normalize_phone(match.group(0))
                            if normalized:
                                phones.add(normalized)

        except Exception as e:
            print(f"[WARN] Error parsing HTML attributes for phones: {e}")

    # -------------------------------------------------------------------------
    # ШАГ 3: Дополнительный поиск (compact формат)
    # -------------------------------------------------------------------------

    compact_pattern = r'(?:\+7|8)\d{10,11}'
    compact_phones = re.findall(compact_pattern, text)

    for phone_candidate in compact_phones:
        normalized = _normalize_phone(phone_candidate)
        if normalized:
            phones.add(normalized)

    return phones


def _normalize_phone(phone: str) -> str:
    """Нормализация телефона к формату +7XXXXXXXXXX."""
    if not phone:
        return None

    original = phone

    # Обрезаем добавочные номера
    extension_patterns = [
        r'\s*[дД]об\.?\s*\d+',
        r'\s*[дД]обавочный\s*\d+',
        r'\s*[eE]xt\.?\s*\d+',
        r'\s*[eE]xtension\s*\d+',
        r'\s*-\s*\d{2,4}$',
    ]

    for pattern in extension_patterns:
        phone = re.sub(pattern, '', phone, flags=re.IGNORECASE)

    # Извлекаем только цифры и +
    digits_only = re.sub(r'[^\d+]', '', phone)

    # Обрабатываем код страны
    if digits_only.startswith('8') and len(digits_only) == 11:
        digits_only = '+7' + digits_only[1:]
    elif digits_only.startswith('+7'):
        pass
    elif digits_only.startswith('7') and len(digits_only) == 11:
        digits_only = '+' + digits_only
    elif digits_only.startswith('8') and len(digits_only) == 10:
        digits_only = '+7' + digits_only[1:]
    elif digits_only.startswith('+'):
        pass
    elif digits_only.startswith('8'):
        digits_only = '+7' + digits_only[1:]

    # Проверка длины
    digits_count = len(re.sub(r'[^\d]', '', digits_only))

    if digits_count > PHONE_MAX_DIGITS:
        return None

    if digits_count < PHONE_MIN_DIGITS:
        return None

    if not digits_only.startswith('+7'):
        return None

    # Финальная нормализация
    normalized = '+' + ''.join(re.findall(r'\d', digits_only))

    if len(normalized) == 12:
        return normalized
    elif len(normalized) == 13 and normalized.startswith('+7'):
        return normalized

    return None


# =============================================================================
# ФУНКЦИЯ 5: ИЗВЛЕЧЕНИЕ ТЕКСТА ИЗ HTML
# =============================================================================

def extract_text_from_html(html_content: str) -> str:
    """Извлекает текст из HTML через BeautifulSoup.get_text()."""
    try:
        soup = BeautifulSoup(html_content, 'html.parser')
        text = soup.get_text(separator=' ', strip=True)
        return text
    except Exception as e:
        print(f"[WARN] Error extracting text from HTML: {e}")
        return ""


# =============================================================================
# ФУНКЦИЯ 6: ОБРАБОТКА ОДНОГО ФАЙЛА (FIXED)
# =============================================================================

def process_file(file_path: Path) -> dict:
    """
    Обрабатывает один HTML-файл.

    FIX v1.0.1:
    - Создаём soup объект один раз и передаём в extract_emails/extract_phones
    - Избегаем повторного парсинга HTML
    """
    result = {
        'file'  : file_path.name,
        'phones': set(),
        'emails': set(),
        'errors': []
    }

    try:
        # Шаг 1: Чтение файла
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            raw_html = f.read()

        # Шаг 2: Очистка HTML
        cleaned_html = clean_html(raw_html)

        # Шаг 3: Предварительная обработка
        processed_html = preprocess_text(cleaned_html)
        processed_raw = preprocess_text(raw_html)

        # Шаг 4: Создаём soup объект ОДИН раз (FIX)
        # Раньше парсили HTML多次, теперь один раз
        soup = BeautifulSoup(processed_raw, 'html.parser')

        # Шаг 5: Извлечение текста
        text_content = soup.get_text(separator=' ', strip=True)

        # Шаг 6: Извлечение email (передаём soup объект)
        emails = extract_emails(text_content, soup)
        result['emails'] = emails

        # Шаг 7: Извлечение телефонов (передаём soup объект)
        phones = extract_phones(text_content, soup)
        result['phones'] = phones

    except Exception as e:
        result['errors'].append(f"Error processing {file_path.name}: {str(e)}")
        print(f"[ERROR] {result['errors'][-1]}")

    return result


# =============================================================================
# ФУНКЦИЯ 7: ОБРАБОТКА ВСЕХ ФАЙЛОВ
# =============================================================================

def process_directory(directory: Path) -> List[dict]:
    """Обрабатывает все HTML-файлы в папке."""
    results = []

    if not directory.exists():
        print(f"[ERROR] Directory not found: {directory}")
        print("[INFO] Создайте папку PAGES и поместите туда HTML-файлы")
        return results

    html_files = list(directory.glob('*.html'))
    html_files.extend(list(directory.glob('*.htm')))

    if not html_files:
        print(f"[WARN] No HTML files found in {directory}")
        return results

    print(f"[INFO] Found {len(html_files)} HTML file(s) in {directory}")
    print("-" * 60)

    for file_path in sorted(html_files):
        result = process_file(file_path)
        results.append(result)

        print("-" * 60)
        print(f"FILE: {result['file']}")

        if result['phones']:
            print("PHONES:")
            for phone in sorted(result['phones']):
                print(f"  {phone}")
        else:
            print("PHONES: (none found)")

        if result['emails']:
            print("EMAILS:")
            for email in sorted(result['emails']):
                print(f"  {email}")
        else:
            print("EMAILS: (none found)")

        if result['errors']:
            print("ERRORS:")
            for error in result['errors']:
                print(f"  {error}")

        print("-" * 60)
        print()

    return results


# =============================================================================
# ТОЧКА ВХОДА
# =============================================================================

def main():
    """Главная функция."""
    # Устанавливаем кодировку вывода для корректного отображения Unicode
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    else:
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

    print("=" * 60)
    print("LeadExtractor — Contact Extraction Module")
    print("Version: 1.0.1 (FIXED)")
    print("=" * 60)
    print()

    results = process_directory(PAGES_DIR)

    if results:
        total_phones = sum(len(r['phones']) for r in results)
        total_emails = sum(len(r['emails']) for r in results)
        files_with_contacts = sum(1 for r in results if r['phones'] or r['emails'])

        print()
        print("=" * 60)
        print("SUMMARY")
        print("=" * 60)
        print(f"Files processed: {len(results)}")
        print(f"Files with contacts: {files_with_contacts}")
        print(f"Total phones found: {total_phones}")
        print(f"Total emails found: {total_emails}")
        print("=" * 60)


if __name__ == '__main__':
    main()