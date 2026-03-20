#!/usr/bin/env python3
"""
LeadExtractor - извлечение контактов из HTML-файлов.
"""

"""
===============================================
SUMMARY
===============================================
Files processed: 22
Files with contacts: 22
Total phones found: 132
Total emails found: 46
===============================================
"""

import re
import sys
import os
from pathlib import Path
from typing import List, Set
from bs4 import BeautifulSoup, Comment


def clean_html(html_content: str) -> str:
    """
    Удаляет теги <script>, <style>, комментарии и возвращает очищенный текст.
    Также удаляет лишние пробелы и переносы строк.

    ВОЗМОЖНЫЕ ОШИБКИ:
    - BeautifulSoup может некорректно обработать битый HTML, что приведёт к потере текста.
    - Некоторые скрипты могут быть встроены в комментарии, которые удаляются.

    УЛУЧШЕНИЯ:
    - Можно добавить обработку тегов <noscript>, <iframe>.
    - Сохранять текст из атрибутов (например, title, alt) для увеличения recall.
    """
    soup = BeautifulSoup(html_content, 'html.parser')

    # Удалить теги script и style
    for tag in soup(['script', 'style']):
        tag.decompose()

    # Удалить HTML комментарии
    for comment in soup.find_all(string=lambda text: isinstance(text, Comment)):
        comment.extract()

    # Получить текст с сохранением разделителей (пробелы)
    text = soup.get_text(separator=' ', strip=True)

    # Заменить множественные пробелы и переносы на один пробел
    text = re.sub(r'\s+', ' ', text)
    return text


def extract_emails(text: str) -> List[str]:
    """
    Извлекает email-адреса из текста.
    Поддерживает mailto: ссылки и обычные email в тексте.

    ВОЗМОЖНЫЕ ОШИБКИ:
    - Паттерн может пропустить email с Unicode символами (нестандартные домены).
    - Может захватить случайные строки, похожие на email (ложные срабатывания).

    УЛУЧШЕНИЯ:
    - Использовать более строгий RFC-5322 паттерн.
    - Валидировать домены через список публичных суффиксов.
    - Учитывать email в кодировке (например, "user [at] domain").
    """
    # Паттерн для email (стандартный)
    email_pattern = r'\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b'
    emails = re.findall(email_pattern, text)

    # Также ищем mailto: ссылки
    mailto_pattern = r'mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})'
    mailto_emails = re.findall(mailto_pattern, text, re.IGNORECASE)
    all_emails = emails + mailto_emails

    # Удалить дубликаты, сохраняя порядок
    seen = set()
    unique_emails = []
    for email in all_emails:
        email_lower = email.lower()
        if email_lower not in seen:
            seen.add(email_lower)
            unique_emails.append(email)

    return unique_emails


def extract_phones(text: str) -> List[str]:
    """
    Извлекает российские телефонные номера из текста.
    Требования:
      - начинается с +7 или 8
      - содержит 10–11 цифр (включая код страны)
      - допускаются пробелы, дефисы, скобки
      - исключает чистые числа без форматирования (например, 74951234567)

    ВОЗМОЖНЫЕ ОШИБКИ:
    - Ложные срабатывания на числа, похожие на телефоны (например, ИНН, коды).
    - Не захватывает номера с международным форматом (+7 ...) без пробелов.
    - Может пропустить номера с нестандартными разделителями (точка, косая черта).

    УЛУЧШЕНИЯ:
    - Использовать библиотеку phonenumbers для валидации.
    - Добавить проверку на валидность кода оператора (префиксы).
    - Исключать числа, которые являются частью дат, сумм, ID (эвристики).
    """
    # Паттерн для поиска кандидатов
    # Ищем последовательности, которые могут содержать +7 или 8, затем разделители и цифры
    # Более гибкий паттерн, чтобы захватить различные форматы
    phone_candidate_pattern = r'(?:\+7|8)[\s\-()]*\d[\s\-()]*\d[\s\-()]*\d[\s\-()]*\d[\s\-()]*\d[\s\-()]*\d[\s\-()]*\d[\s\-()]*\d[\s\-()]*\d[\s\-()]*\d[\s\-()]*\d?'

    candidates = re.findall(phone_candidate_pattern, text)

    valid_phones = []
    for candidate in candidates:
        # ИСКЛЮЧЕНИЕ: если кандидат состоит только из цифр (и возможно +), это чистое число без форматирования
        # Проверяем, есть ли в кандидате хотя бы один нецифровой символ (кроме +)
        if re.fullmatch(r'[\d\+]+', candidate):
            # Чистые числа без разделителей - пропускаем
            continue
        # Дополнительная проверка: если кандидат не содержит ни одного разделителя (пробел, дефис, скобка)
        # и не начинается с '+', то это тоже чистое число (например, 84951234567)
        if not re.search(r'[\s\-()]', candidate) and not candidate.startswith('+'):
            continue

        # Нормализуем: оставляем только цифры
        digits = re.sub(r'\D', '', candidate)
        # Проверяем длину: должно быть 10 или 11 цифр (если начинается с 7 или 8)
        if len(digits) == 11 and digits[0] == '7':
            # Номер в формате 7XXXXXXXXXX (российский)
            valid_phones.append(digits)
        elif len(digits) == 11 and digits[0] == '8':
            # Номер в формате 8XXXXXXXXXX (российский)
            valid_phones.append(digits)
        elif len(digits) == 10:
            # Если 10 цифр, возможно, пропущена ведущая 7 или 8, но по паттерну мы уже имеем +7 или 8
            # Добавляем ведущую 7 для единообразия
            valid_phones.append('7' + digits)
        else:
            # Не подходит под требования
            continue

    # Удалить дубликаты
    seen = set()
    unique_phones = []
    for phone in valid_phones:
        if phone not in seen:
            seen.add(phone)
            unique_phones.append(phone)

    return unique_phones


def process_file(file_path: Path) -> dict:
    """
    Обрабатывает один HTML-файл, извлекает телефоны и email.
    Возвращает словарь с результатами.

    ВОЗМОЖНЫЕ ОШИБКИ:
    - Файл может быть в неизвестной кодировке, что приведёт к искажению текста.
    - Большие файлы могут потреблять много памяти (чтение целиком).

    УЛУЧШЕНИЯ:
    - Использовать потоковое чтение для больших файлов.
    - Добавить определение кодировки через chardet для повышения точности.
    - Кэширование очищенного текста для повторного использования.
    """
    # Попробуем несколько кодировок с заменой нечитаемых символов
    encodings = ['utf-8', 'cp1251', 'windows-1251', 'iso-8859-1']
    html = None
    for enc in encodings:
        try:
            with open(file_path, 'r', encoding=enc, errors='replace') as f:
                html = f.read()
            break
        except UnicodeDecodeError:
            continue
        except Exception as e:
            return {'file': str(file_path), 'error': str(e), 'phones': [], 'emails': []}
    if html is None:
        # Если ни одна кодировка не подошла, читаем как байты и игнорируем ошибки
        with open(file_path, 'rb') as f:
            html = f.read().decode('utf-8', errors='replace')

    cleaned_text = clean_html(html)
    phones = extract_phones(cleaned_text)
    emails = extract_emails(cleaned_text)

    return {
        'file': str(file_path),
        'phones': phones,
        'emails': emails,
    }


def format_output(result: dict) -> str:
    """Форматирует результат для вывода в консоль."""
    lines = []
    lines.append('-' * 40)
    lines.append(f"FILE: {os.path.basename(result['file'])}")
    lines.append('')
    lines.append('PHONES:')
    if result.get('phones'):
        for phone in result['phones']:
            lines.append(phone)
    else:
        lines.append('(none)')
    lines.append('')
    lines.append('EMAILS:')
    if result.get('emails'):
        for email in result['emails']:
            lines.append(email)
    else:
        lines.append('(none)')
    lines.append('-' * 40)
    return '\n'.join(lines)


def main():
    """Основная функция: обходит папку PAGES и выводит результаты."""
    # Настраиваем stdout на UTF-8, чтобы избежать ошибок кодировки
    if sys.version_info >= (3, 7):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    else:
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

    pages_dir = Path('PAGES')
    if not pages_dir.exists():
        print(f"Directory {pages_dir} not found.")
        sys.exit(1)

    html_files = list(pages_dir.glob('*.html'))
    if not html_files:
        print("No HTML files found in PAGES directory.")
        return

    # Статистика
    total_files = len(html_files)
    files_with_contacts = 0
    total_phones = 0
    total_emails = 0

    for file_path in html_files:
        result = process_file(file_path)
        # Используем безопасный вывод
        try:
            print(format_output(result))
        except UnicodeEncodeError:
            # Если всё же ошибка, выводим raw bytes
            sys.stdout.buffer.write(format_output(result).encode('utf-8', 'replace'))
            sys.stdout.buffer.write(b'\n')

        # Обновляем статистику
        phones = result.get('phones', [])
        emails = result.get('emails', [])
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


if __name__ == '__main__':
    main()