#!/usr/bin/env python3
"""
extractor_runner.py — Простой runner для тестирования extraction.
Читает links.txt → скачивает HTML → передаёт в extractor_final.py → вывод.
"""

import sys
import re
from pathlib import Path

import requests

# Импортируем функции из extractor_final (НЕ меняя его)
from extractor_final import (
    clean_html,
    extract_emails,
    extract_emails_from_hrefs,
    extract_emails_from_data_attrs,
    extract_phones,
    extract_phones_from_hrefs,
    extract_local_phones,
)

LINKS_FILE = Path(__file__).parent / "links.txt"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
}


def read_links(filepath: Path) -> list[str]:
    if not filepath.exists():
        print(f"[!] Файл не найден: {filepath}")
        return []
    with open(filepath, "r", encoding="utf-8") as f:
        return [line.strip() for line in f if line.strip() and not line.startswith("#")]


def fetch_html(url: str) -> str | None:
    try:
        resp = requests.get(url, headers=HEADERS, timeout=10)
        resp.raise_for_status()
        return resp.text
    except Exception as e:
        print(f"[!] Ошибка загрузки {url}: {e}")
        return None


def process_html(html: str) -> dict:
    """Извлекает контакты из HTML через extractor_final."""
    clean_text, hrefs, soup = clean_html(html)

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

    return {"phones": all_phones, "emails": all_emails}


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    links = read_links(LINKS_FILE)
    if not links:
        print(f"[!] Нет ссылок в {LINKS_FILE}")
        return

    print(f"[*] Загружено {len(links)} ссылок из {LINKS_FILE}\n")

    total_phones = 0
    total_emails = 0

    for url in links:
        print(f"--- {url} ---")
        html = fetch_html(url)
        if not html:
            print()
            continue

        result = process_html(html)

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

        print()
        total_phones += len(result["phones"])
        total_emails += len(result["emails"])

    print("=" * 40)
    print(f"ИТОГО: {len(links)} страниц, {total_phones} телефонов, {total_emails} email")


if __name__ == "__main__":
    main()
