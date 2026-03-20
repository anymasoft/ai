#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LeadExtractor Core — исправленная версия (encoding + precision)
"""

"""
===============================================
SUMMARY
===============================================
Files processed: 22
Files with contacts: 21
Total phones found: 99
Total emails found: 55
===============================================
"""

import os
import re
import html
import sys
from urllib.parse import unquote_plus
from bs4 import BeautifulSoup, Comment
from typing import List


def read_file_with_encoding(file_path: str) -> str:
    """Автоопределение кодировки русских HTML (решает все твои ошибки)"""
    encodings = ['utf-8', 'utf-8-sig', 'windows-1251', 'cp1251', 'iso-8859-5']
    for enc in encodings:
        try:
            with open(file_path, 'r', encoding=enc) as f:
                return f.read()
        except UnicodeDecodeError:
            continue
    raise UnicodeDecodeError(f"Не удалось прочитать файл {os.path.basename(file_path)}")


def clean_html(raw_html: str) -> BeautifulSoup:
    unescaped = html.unescape(raw_html)
    decoded = unquote_plus(unescaped)
    soup = BeautifulSoup(decoded, "html.parser")

    for tag in soup.find_all(["script", "style"]):
        tag.decompose()
    for comment in soup.find_all(string=lambda text: isinstance(text, Comment)):
        comment.extract()

    return soup


def get_clean_text(soup: BeautifulSoup) -> str:
    text = soup.get_text(separator=" ")
    return re.sub(r'\s+', " ", text).strip()


def extract_emails(text: str) -> List[str]:
    pattern = re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', re.IGNORECASE)
    candidates = pattern.findall(text)
    filtered = []
    for email in candidates:
        lower = email.lower()
        if re.search(r'\.(png|jpe?g|gif|svg|ico|css|js|json|html)$', lower):
            continue
        filtered.append(email)
    return filtered


def extract_phones(text: str) -> List[str]:
    """Только номера, начинающиеся строго с +7 или 8"""
    pattern = re.compile(r'(?:\+7|8)(?:[\s\xa0\-\(\)\.]+\d){8,10}', re.IGNORECASE)
    candidates = []
    for match in pattern.finditer(text):
        cand = match.group(0).strip()
        digits = re.sub(r'\D', '', cand)
        if 10 <= len(digits) <= 11 and digits[0] in ('7', '8'):
            candidates.append(cand)
    return candidates


def extract_emails_from_attrs(soup: BeautifulSoup) -> List[str]:
    emails = []
    for tag in soup.find_all(href=True):
        href = str(tag['href']).strip()
        if href.lower().startswith('mailto:'):
            email = href[7:].strip()
            if email:
                emails.append(email)
    return emails


def extract_phones_from_attrs(soup: BeautifulSoup) -> List[str]:
    """Строго по требованию: только если tel: начинается с +7 или 8"""
    phones = []
    for tag in soup.find_all(href=True):
        href = str(tag['href']).strip()
        if href.lower().startswith('tel:'):
            phone_raw = href[4:].strip()
            # Дополнительная проверка — только валидные префиксы
            if re.match(r'^\+?7|8', phone_raw):
                digits = re.sub(r'\D', '', phone_raw)
                if 10 <= len(digits) <= 11 and digits[0] in ('7', '8'):
                    phones.append(phone_raw)
    return phones


def process_file(file_path: str):
    try:
        raw_html = read_file_with_encoding(file_path)
        soup = clean_html(raw_html)
        text = get_clean_text(soup)

        emails_text = extract_emails(text)
        phones_text = extract_phones(text)
        emails_attr = extract_emails_from_attrs(soup)
        phones_attr = extract_phones_from_attrs(soup)

        # Дедупликация email
        all_emails = sorted(set(emails_text + emails_attr))

        # Дедупликация телефонов по цифрам
        phone_map = {}
        for p in phones_text + phones_attr:
            norm = re.sub(r'\D', '', p)
            if norm not in phone_map:
                phone_map[norm] = p
        all_phones = list(phone_map.values())

        print("-----------------------------------")
        print(f"FILE: {os.path.basename(file_path)}")
        print("PHONES:")
        for phone in all_phones:
            print(phone)
        print("EMAILS:")
        for email in all_emails:
            print(email)
        print("-----------------------------------")

        return all_phones, all_emails

    except Exception as e:
        print(f"ERROR processing {os.path.basename(file_path)}: {e}")
        return [], []


def main():
    # Устанавливаем кодировку вывода для корректного отображения Unicode
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    else:
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

    pages_dir = "PAGES"
    if not os.path.isdir(pages_dir):
        print(f"Папка '{pages_dir}' не найдена!")
        return

    html_files = [f for f in os.listdir(pages_dir) if f.lower().endswith('.html')]
    if not html_files:
        print("В папке PAGES нет HTML-файлов.")
        return

    # Статистика
    total_files = len(html_files)
    files_with_contacts = 0
    total_phones = 0
    total_emails = 0

    for filename in sorted(html_files):
        path = os.path.join(pages_dir, filename)
        phones, emails = process_file(path)
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