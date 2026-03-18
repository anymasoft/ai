import re
import phonenumbers
from typing import List, Tuple

def extract_emails(text: str) -> List[str]:
    """Извлечь email адреса из текста."""
    pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
    emails = re.findall(pattern, text)
    return list(set(emails))

def extract_phones(text: str) -> List[str]:
    """Извлечь номера телефонов из текста."""
    phones = []

    # Быстрый паттерн для очевидных номеров
    patterns = [
        r'\+?\d{1,3}[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}',
        r'\(\d{1,4}\)\s?\d{1,4}[-.\s]?\d{1,9}',
        r'\d{3}[-.]?\d{3}[-.]?\d{4}',
    ]

    for pattern in patterns:
        matches = re.findall(pattern, text)
        phones.extend(matches)

    # Очистить дубликаты
    phones = list(set(phones))

    return phones[:3]  # Максимум 3 телефона на сайт

def extract_contacts(url: str, html_content: str, text_content: str) -> Tuple[List[str], List[str]]:
    """Извлечь контакты из контента страницы."""
    combined = f"{html_content} {text_content}".lower()

    emails = extract_emails(combined)
    phones = extract_phones(text_content)

    return emails[:5], phones[:3]  # Максимум 5 emails и 3 phones
