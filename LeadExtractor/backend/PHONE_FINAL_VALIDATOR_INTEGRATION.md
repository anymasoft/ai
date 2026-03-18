# 📱 PHONE FINAL VALIDATOR — Инструкции Интеграции

## 🎯 Цель

Добавить финальную LLM-валидацию (GPT-4o-mini) в pipeline extraction телефонов.

**Результат:** только чистые русские номера в формате `+7 (812) 250-62-10`

---

## 📋 Шаг 1: Настроить .env

Добавьте в файл `.env` в корне проекта:

```bash
# .env (в корне LeadExtractor/)

# ⭐ ОБЯЗАТЕЛЬНО: OpenAI API ключ
OPENAI_API_KEY=sk-proj-xxxxx...

# ⭐ ОБЯЗАТЕЛЬНО: Модель OpenAI для LLM валидации
# Рекомендуется: gpt-4o-mini (дешево и быстро)
OPENAI_MODEL=gpt-4o-mini

# Опционально: контролировать использование LLM
USE_LLM_VALIDATION=true
```

**Где получить OPENAI_API_KEY:**
1. Перейти на https://platform.openai.com/api-keys
2. Создать новый ключ (API Key)
3. Скопировать в .env

**Стоимость:**
- GPT-4o-mini очень дешёвая модель ($0.15 за 1M input токенов)
- На один список из 10 номеров: ~$0.0001 (0.01 копейки)

---

## 🔧 Шаг 2: Добавить Импорт в crawl4ai_client.py

В начало файла `backend/crawl4ai_client.py` добавьте:

```python
# Добавить после других импортов (строка ~15)
from phone_final_validator import validate_phones  # ⭐ НОВЫЙ ИМПОРТ
```

**Полный список импортов в crawl4ai_client.py должен быть:**

```python
import asyncio
import re
import logging
import requests
from typing import Dict, List, Optional, Tuple, Set
from urllib.parse import urlparse, urljoin
from collections import deque

# ⭐ Новый модульный phone_extractor (v1.0)
from phone_extractor import extract_phones_from_crawl_result

# ⭐ Финальная LLM валидация
from phone_final_validator import validate_phones

logger = logging.getLogger(__name__)
```

---

## 🔄 Шаг 3: Интегрировать в Метод extract()

В методе `Crawl4AIClient.extract()` найдите место где обрабатываются телефоны:

### ДО (Old Code):

```python
# Примерно на строке 629
emails_on_page, phones_on_page = self._extract_contacts(
    result, current_url, all_emails, all_phones
)
if emails_on_page or phones_on_page:
    logger.info(f"  ✓ Found {len(emails_on_page)} emails, {len(phones_on_page)} phones")
```

### ПОСЛЕ (New Code):

```python
# Примерно на строке 629
# НОВЫЙ PIPELINE С ФИНАЛЬНОЙ ВАЛИДАЦИЕЙ:
# 1. Extraction через phone_extractor
# 2. Финальная валидация через LLM

phones_extracted = extract_phones_from_crawl_result(result)

if phones_extracted:
    # ⭐ Добавить финальную LLM валидацию
    page_text = getattr(result, 'markdown', '') or getattr(result, 'cleaned_html', '')

    phones_validated = validate_phones(
        phones_extracted,
        page_url=current_url,
        page_text=page_text,
        use_llm=True  # Включить LLM валидацию
    )

    # Добавить в результаты
    for phone_info in phones_validated:
        all_phones.append(phone_info)

    logger.info(
        f"  ✓ Found {len(phones_validated)} phones after LLM validation "
        f"(confidence: {[p['confidence'] for p in phones_validated]})"
    )
```

---

## 💡 Шаг 4: Опционально — Обновить Структуру Данных

Если вы храните телефоны в формате простых строк, обновите на dict:

### ДО:

```python
all_phones = set()  # Просто строки
all_phones.add("+7 (812) 250-62-10")
```

### ПОСЛЕ:

```python
all_phones = []  # Список dict с информацией
all_phones.append({
    "phone": "+7 (812) 250-62-10",
    "source_page": current_url,
    "confidence": "high",
    "method": "phonenumbers"
})
```

---

## 📊 Полный Пример Использования

### Пример 1: Простое Использование

```python
from phone_final_validator import validate_phones

# Сырые номера из extraction
raw_phones = [
    {"phone": "+7 (812) 250-62-10", "source_page": "https://..."},
    {"phone": "+7%20(812)%20250-62-10%20", "source_page": "https://..."},
    {"phone": "237153142)", "source_page": "https://..."},
]

# Финальная валидация
validated = validate_phones(
    raw_phones,
    page_url="https://is1c.ru",
    page_text="Контакты компании...",
    use_llm=True
)

# Результат
for p in validated:
    print(f"{p['phone']} ({p['confidence']})")
    # Output:
    # +7 (812) 250-62-10 (high)
    # +7 (812) 250-62-10 (high)
```

### Пример 2: В BFS Crawl

```python
async def extract(self, domain_url: str) -> Dict:
    """BFS extraction с финальной LLM валидацией"""

    all_phones = []

    while queue and page_count < self.max_pages:
        current_url, depth = queue.popleft()

        # ... fetch и обработка ...

        result = await self._fetch_page(crawler, current_url)
        if result:
            # Extraction
            phones = extract_phones_from_crawl_result(result)

            # ⭐ Финальная LLM валидация
            page_text = result.markdown or result.cleaned_html or ""
            phones_validated = validate_phones(
                phones,
                page_url=current_url,
                page_text=page_text[:500],  # Первые 500 символов
                use_llm=True
            )

            all_phones.extend(phones_validated)

    return {
        "domain": domain_url,
        "phones": all_phones  # Только чистые номера!
    }
```

### Пример 3: Отключить LLM для Экономии

```python
# Если нужно экономить деньги, отключить LLM:

validated = validate_phones(
    raw_phones,
    page_url="https://...",
    use_llm=False  # ⭐ Только phonenumbers, без LLM
)

# Результат: будут только номера которые прошли phonenumbers
```

---

## 🧪 Тестирование

### Запустить Встроенные Тесты:

```bash
cd backend/

python3 phone_final_validator.py
```

**Вывод:**

```
======================================================================
PHONE FINAL VALIDATOR — TEST
======================================================================

Результат: 2 валидных номера

✅ +7 (812) 250-62-10
   Confidence: high
   Method: phonenumbers

✅ +7 (383) 209-21-27
   Confidence: medium
   Method: llm
```

### Запустить на Real Website:

```python
import asyncio
from crawl4ai import AsyncWebCrawler
from phone_final_validator import validate_phones

async def test_is1c():
    crawler = AsyncWebCrawler()
    result = await crawler.arun("https://is1c.ru/contacts")

    # Получить raw phones (из extraction pipeline)
    from phone_extractor import extract_phones_from_crawl_result
    raw_phones = extract_phones_from_crawl_result(result)

    # Финальная валидация
    validated = validate_phones(
        raw_phones,
        page_url=result.url,
        page_text=result.markdown
    )

    print(f"✅ {len(validated)} валидных номеров:")
    for p in validated:
        print(f"  {p['phone']} ({p['confidence']})")

    await crawler.close()

asyncio.run(test_is1c())
```

---

## 📈 Что Произойдёт

### Было (без LLM):

```
Найдено: 8 номеров
❌ +7%20(812)%20250-62-10%20  (не декодирован)
❌ 237153142)                 (мусор)
❌ +7                         (слишком короткий)
❌ -03022026.                 (дата)
❌ (55036117                  (обрезан)
✅ +7 (812) 250-62-10         (OK)
✅ +7 (383) 209-21-27         (OK)
❌ ... (другой мусор)
```

### Стало (с LLM):

```
Найдено: 8 номеров
✅ +7 (812) 250-62-10  (phonenumbers)
✅ +7 (812) 250-62-10  (LLM одобрил)
✅ +7 (383) 209-21-27  (LLM одобрил)

Валидных: 3 номера (NO GARBAGE!)
```

---

## 💰 Стоимость API Calls

**На сайте is1c.ru с 10 страницами:**

- Всего кандидатов: ~50 номеров
- Прошли phonenumbers: ~35 номеров (70%)
- В LLM отправится: ~15 номеров (30%)
- Стоимость одного LLM call: ~$0.0001
- **Итого на сайт: ~$0.0015 (0.15 копейки)**

**На 100 сайтов: ~$0.15 (15 копеек)**

---

## 🔐 Безопасность .env

**ВАЖНО:** .env НЕ должен быть в git!

Проверьте `.gitignore`:

```bash
# В LeadExtractor/.gitignore
.env
.env.local
*.key
```

---

## 🚨 Troubleshooting

### Ошибка: "OPENAI_API_KEY not found"

```
❌ ValueError: OPENAI_API_KEY не найден в .env
```

**Решение:**
1. Создать файл `.env` в корне LeadExtractor/
2. Добавить `OPENAI_API_KEY=sk-...`

### Ошибка: "OpenAI API error"

```
❌ OpenAI API error: Invalid API key
```

**Решение:**
1. Проверить что ключ корректный на https://platform.openai.com/api-keys
2. Убедиться что у аккаунта есть credit/план оплаты

### LLM не использует кэш

```
[LLM API CALL] Sending ... candidates to GPT-4o-mini
```

Это нормально если номера разные. Кэш работает для ОДИНАКОВЫХ списков номеров.

---

## 📚 Связанные Файлы

- `phone_normalizer.py` — Basic normalization
- `phone_extractor.py` — Extraction from HTML
- `phone_final_validator.py` — ⭐ LLM final validation
- `crawl4ai_client.py` — Main client (нужно обновить)

---

## ✅ Checklist Интеграции

- [ ] Создать/обновить `.env` с `OPENAI_API_KEY`
- [ ] Добавить импорт в `crawl4ai_client.py`
- [ ] Обновить метод `extract()`
- [ ] Запустить тесты `phone_final_validator.py`
- [ ] Тестировать на реальном сайте (is1c.ru, etc.)
- [ ] Убедиться что `.env` в `.gitignore`
- [ ] Commit и push

---

## 🎊 Ready!

После этих шагов pipeline будет:

```
Raw phones from HTML
    ↓
[phone_extractor.py] — extraction & URL-decode
    ↓
List of candidates
    ↓
[phone_final_validator.py] — phonenumbers + LLM
    ↓
✅ Clean phones with confidence
```

**Результат на is1c.ru:** только реальные номера без мусора!
