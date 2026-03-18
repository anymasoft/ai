"""
📱 PHONE NORMALIZER v1.0 — ПОЛНОЕ РУКОВОДСТВО

Специализированный модуль для очистки и нормализации телефонных номеров.
Решает все проблемы с мусором и неправильными форматами.
"""

# ============================================================================
# ПРИМЕРЫ ИСПОЛЬЗОВАНИЯ
# ============================================================================

# ПРИМЕР 1: Простая нормализация одного номера
# ════════════════════════════════════════════════

from backend.phone_normalizer import normalize_phone

# Примеры проблемных входных данных
raw_phone = "+7%20(812)%20250-62-10%20"  # URL-кодированный с пробелом в конце
result = normalize_phone(raw_phone)

print(f"Input:  {raw_phone}")
print(f"Output: {result}")  # Output: +7 (812) 250-62-10


# ПРИМЕР 2: Нормализация класса PhoneNormalizer
# ═════════════════════════════════════════════════

from backend.phone_normalizer import PhoneNormalizer

normalizer = PhoneNormalizer(region="RU")

# Различные форматы входных данных
test_phones = [
    "+7 (495) 123-45-67",      # Нормальный формат
    "+7-812-250-62-10",        # С дефисами
    "8 (383) 262-16-42",       # Начинается с 8
    "+7%20(812)%20250-62-10",  # URL-кодированный
    "tel:+7(495)123-45-67",    # Tel ссылка
]

for phone in test_phones:
    normalized = normalizer.normalize_phone(phone)
    print(f"{phone:30} → {normalized}")


# ПРИМЕР 3: Дедубликация на примере
# ════════════════════════════════════

raw_phones = [
    "+7 (495) 123-45-67",      # Valid
    "+7-495-123-45-67",        # Same, different format
    "8 (495) 123-45-67",       # Same (8 → 7 conversion)
    "237153142)",              # Garbage
    "+7",                       # Too short
]

normalized_list = []
for raw in raw_phones:
    norm = normalizer.normalize_phone(raw)
    if norm:
        normalized_list.append(norm)

print(f"Raw count: {len(raw_phones)}")
print(f"After normalization: {len(normalized_list)}")
print(f"Result: {set(normalized_list)}")  # Automatic deduplication


# ПРИМЕР 4: Работа с CrawlResult
# ═══════════════════════════════════

from backend.phone_normalizer import extract_phones_from_result
from crawl4ai import AsyncWebCrawler
import asyncio

async def extract_from_website():
    crawler = AsyncWebCrawler()

    # Fetch страница
    result = await crawler.arun("https://is1c.ru")

    # Извлечь все номера (tel: links + fragmented + text)
    phones = extract_phones_from_result(result)

    # Вывести результаты
    for phone_info in phones:
        print(f"✅ {phone_info['phone']}")
        print(f"   Source: {phone_info['source_page']}")
        print(f"   Raw: {phone_info['raw']}")

    await crawler.close()

# asyncio.run(extract_from_website())


# ПРИМЕР 5: Merge fragmented phones
# ═════════════════════════════════════

from bs4 import BeautifulSoup

html_with_fragmented = """
<html>
    <body>
        <p>Звоните:</p>
        <span>+7</span><span>985</span><span>587</span>
        <div>Тел. (812) 250-62-10</div>
    </body>
</html>
"""

soup = BeautifulSoup(html_with_fragmented, 'html.parser')
fragmented_phones = normalizer.merge_fragmented_phones(soup)

print(f"Found {len(fragmented_phones)} fragmented phones:")
for phone in fragmented_phones:
    print(f"  ✅ {phone}")


# ПРИМЕР 6: Интеграция в FastAPI
# ════════════════════════════════════

from fastapi import FastAPI
from pydantic import BaseModel
from backend.phone_normalizer import extract_phones_from_result
from crawl4ai import AsyncWebCrawler

app = FastAPI()

class ExtractRequest(BaseModel):
    url: str

@app.post("/api/extract-phones")
async def extract_phones_endpoint(request: ExtractRequest):
    """
    Endpoint для extraction телефонов с сайта

    Usage:
        curl -X POST "http://localhost:8000/api/extract-phones" \\
          -H "Content-Type: application/json" \\
          -d '{"url": "https://is1c.ru"}'
    """
    crawler = AsyncWebCrawler()
    try:
        result = await crawler.arun(request.url)
        phones = extract_phones_from_result(result)
        return {"url": request.url, "phones": phones}
    finally:
        await crawler.close()


# ПРИМЕР 7: Обработка массива URLs
# ════════════════════════════════════

async def bulk_extract(urls: list[str]):
    """
    Extraction телефонов с нескольких сайтов
    """
    crawler = AsyncWebCrawler()
    all_results = {}

    for url in urls:
        try:
            print(f"Processing: {url}")
            result = await crawler.arun(url)
            phones = extract_phones_from_result(result)

            all_results[url] = {
                "count": len(phones),
                "phones": phones
            }

        except Exception as e:
            print(f"Error on {url}: {e}")

    await crawler.close()
    return all_results

# Usage:
# results = asyncio.run(bulk_extract([
#     "https://is1c.ru",
#     "https://1cca.ru",
#     "https://example.com"
# ]))


# ПРИМЕР 8: Интеграция в существующий crawl4ai_client.py
# ════════════════════════════════════════════════════════════

# В файле crawl4ai_client.py добавить импорт:
# from phone_normalizer import extract_phones_from_result

# Затем в методе extract(), заменить старую логику:

# БЫЛО:
# emails_on_page, phones_on_page = self._extract_contacts(
#     result, current_url, all_emails, all_phones
# )

# СТАЛО:
# phones_result = extract_phones_from_result(result)
# all_phones.extend(phones_result)


# ============================================================================
# ПРИМЕРЫ ПРОБЛЕМНЫХ ВХОДНЫХ ДАННЫХ И РЕЗУЛЬТАТОВ
# ============================================================================

TEST_CASES = {
    # Нормальные номера
    "+7 (812) 250-62-10": {
        "input": "+7 (812) 250-62-10",
        "output": "+7 (812) 250-62-10",
        "status": "✅ Уже нормальный"
    },

    # URL-кодированные
    "+7%20(812)%20250-62-10%20": {
        "input": "+7%20(812)%20250-62-10%20",
        "output": "+7 (812) 250-62-10",
        "status": "✅ URL-декодирование"
    },

    # Tel ссылки
    "tel:%2B7%20(495)%20123-45-67": {
        "input": "tel:%2B7%20(495)%20123-45-67",
        "output": "+7 (495) 123-45-67",
        "status": "✅ Tel ссылка"
    },

    # Разные форматы
    "+7-495-123-45-67": {
        "input": "+7-495-123-45-67",
        "output": "+7 (495) 123-45-67",
        "status": "✅ Дефисы → скобки"
    },

    "8 (383) 262-16-42": {
        "input": "8 (383) 262-16-42",
        "output": "+7 (383) 262-16-42",
        "status": "✅ 8 → +7"
    },

    # Мусор
    "237153142)": {
        "input": "237153142)",
        "output": None,
        "status": "❌ Скобка в конце (мусор)"
    },

    "+7": {
        "input": "+7",
        "output": None,
        "status": "❌ Слишком короткий"
    },

    "-03022026.": {
        "input": "-03022026.",
        "output": None,
        "status": "❌ Похоже на дату"
    },

    "(55036117": {
        "input": "(55036117",
        "output": None,
        "status": "❌ Неполный номер"
    },
}


# ============================================================================
# ЧЕКЛИСТ ИСПОЛЬЗОВАНИЯ
# ============================================================================

"""
CHECKLIST ДЛЯ ИНТЕГРАЦИИ:

[ ] 1. Импортировать модуль
    from backend.phone_normalizer import normalize_phone, extract_phones_from_result

[ ] 2. Использовать в вашем коде
    # Вариант A: Простая нормализация
    normalized = normalize_phone("+7%20(812)%20250-62-10%20")

    # Вариант B: Extraction из CrawlResult
    phones = extract_phones_from_result(result)

[ ] 3. Проверить результаты
    # Проверить что мусор удален
    # Проверить что валидные номера нормализованы
    # Проверить URL-кодированные номера декодированы

[ ] 4. Настроить логирование (опционально)
    import logging
    logging.basicConfig(level=logging.DEBUG)

[ ] 5. Тестировать на реальных сайтах
    - is1c.ru
    - 1cca.ru
    - company.io

[ ] 6. Интегрировать в FastAPI endpoint (опционально)

[ ] 7. Добавить в requirements.txt если нужно
    - beautifulsoup4 (уже добавлена)
    - phonenumbers (уже добавлена)
"""


# ============================================================================
# FAQ И РЕШЕНИЕ ПРОБЛЕМ
# ============================================================================

"""
Q: Почему некоторые числа удаляются?
A: Это мусор. Проверьте в логах какой фильтр их отклонил:
   - [SANITY] = не прошла санити-проверку (слишком короткий, дата, и т.д.)
   - [PHONENUMBERS] Invalid = невалидный номер
   - Too many dots = IP адрес или версия

Q: Как изменить регион (не только RU)?
A: normalizer = PhoneNormalizer(region="US")

Q: Почему не работает merge_fragmented_phones?
A: Убедитесь что:
   1. Передаете BeautifulSoup объект (не строку)
   2. HTML содержит <span>, <div> и другие теги
   3. Числа рядом друг с другом

Q: Как обработать другие страны кроме Russia?
A: phonenumbers library поддерживает все страны.
   Просто используйте правильный region код:
   - US → "US"
   - GB → "GB"
   - DE → "DE"
   - FR → "FR"
"""

print("""
✅ PHONE NORMALIZER v1.0 ГОТОВ К ИСПОЛЬЗОВАНИЮ

Примеры выше показывают все основные способы использования.
Для деталей смотрите docstrings в phone_normalizer.py

Быстрый старт:
    from phone_normalizer import normalize_phone
    result = normalize_phone("+7%20(812)%20250-62-10")
    print(result)  # "+7 (812) 250-62-10"
""")
