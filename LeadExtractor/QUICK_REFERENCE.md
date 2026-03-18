# QUICK REFERENCE - LeadExtractor Backend v3.0

## 1. Инициализация Класса

```python
from crawl4ai_client import Crawl4AIClient

client = Crawl4AIClient(timeout=30, max_pages=10, max_depth=2)
result = await client.extract("example.com")
```

**Результат:**
```json
{
    "emails": [
        {"email": "info@example.com", "source_page": "https://example.com"},
        {"email": "contact@example.com", "source_page": "https://example.com/contact"}
    ],
    "phones": [
        {"phone": "+7 (831) 262-16-42", "source_page": "https://example.com"},
        {"phone": "+7 (495) 123-45-67", "source_page": "https://example.com/contacts"}
    ],
    "sources": ["https://example.com", "https://example.com/contact", ...],
    "status_per_site": {
        "https://example.com": "success",
        "https://example.com/contact": "success"
    }
}
```

---

## 2. Все Regex Patterns с Примерами

### Email Regex (Standard)
```
PATTERN: r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'

ЛОВИТ:
✅ info@example.com
✅ contact.person@company.ru
✅ support+tag@domain.io
✅ name_123@test-site.co.uk

НЕ ЛОВИТ:
❌ test@domain (нет TLD)
❌ @example.com (нет local part)
❌ .email@domain.com (точка в начале)
```

### Email Regex (Aggressive - Contact Pages Only)
```
PATTERN: r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}'

ОТЛИЧИЕ: Нет \b word boundary (ловит в более странных контекстах)
ИСПОЛЬЗУЕТСЯ: Только на /contact, /about, /team

ДОПОЛНИТЕЛЬНО ЛОВИТ:
✅ contact@test.com;
✅ contact@test.com,another@email.com
```

### Mailto Regex
```
PATTERN: r'href=["\']?mailto:([^"\'>\s]+)'

ЛОВИТ:
✅ href="mailto:info@example.com" → info@example.com
✅ href='mailto:contact@test.ru' → contact@test.ru
✅ href=mailto:admin@domain.io → admin@domain.io

НЕ ЛОВИТ:
❌ href="mailtoinfo@example.com" (без двоеточия)
❌ a href="mailto..."  (пробелы между href и значением)
```

### Phone Regex 1 (International)
```
PATTERN: r'\+\d[\d\s\-\(\)]{8,}\d'

ЛОВИТ:
✅ +7 (831) 262-16-42
✅ +78312621642
✅ +1-555-0000
✅ +7 (383) 209-21-27

НЕ ЛОВИТ:
❌ 7-831-262-16-42 (нет +)
❌ +7 123 (слишком коротко)
❌ (831) 262-16-42 (нет + в начале)
```

### Phone Regex 2 (Russian Domestic)
```
PATTERN: r'\b8[\d\s\-\(\)]{8,}\d'

ЛОВИТ:
✅ 8 (831) 262-16-42
✅ 8(831)262-16-42
✅ 8-831-262-1642

НЕ ЛОВИТ:
❌ (831) 262-16-42 (нет 8 в начале)
❌ +7 (831) 262-16-42 (начинается с +, не 8)
```

### Phone Regex 3 (Parentheses)
```
PATTERN: r'\(\d{3}\)[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}'

ЛОВИТ:
✅ (831) 262-16-42
✅ (495)123-45-67
✅ (812)250-62-10
✅ (831)-262-16-42

НЕ ЛОВИТ:
❌ 831 262-16-42 (нет скобок)
❌ (83) 262-16-42 (2 цифры в скобках, а не 3)
```

### Tel Link Regex
```
PATTERN: r'href=["\']?tel:([^"\'>\s]+)'

ЛОВИТ:
✅ href="tel:+7-123-456-7890" → +7-123-456-7890
✅ href='tel:+1(555)0000' → +1(555)0000
✅ href=tel:+78312621642 → +78312621642

НЕ ЛОВИТ:
❌ a href="tel..." (пробелы между атрибутами)
```

### Link Href Regex
```
PATTERN: r'href=["\']([^"\']+)["\']'

ЛОВИТ:
✅ href="https://example.com" → https://example.com
✅ href='path/to/page' → path/to/page
✅ href="/about" → /about

НЕ ЛОВИТ:
❌ href=https://example.com (без кавычек)
❌ src="..." (не href)
```

### Extension Cleanup Regex
```
PATTERN: r',|\s+(?:доб\.?|ext\.?|extension|add\.?|addl\.?|drop)'

ПРИМЕРЫ:
"+7 (831) 262-16-42, доб. 172" → "+7 (831) 262-16-42"
"8(831)262-1642 ext 456" → "8(831)262-1642"
"+1-555-0000, extension 123" → "+1-555-0000"
```

---

## 3. HTML Entity Normalization

```python
REPLACEMENTS = {
    '&nbsp;': ' ',       # Non-breaking space
    '&#160;': ' ',       # Numeric space
    '&ndash;': '-',      # En dash
    '&mdash;': '-',      # Em dash
    '&middot;': '-',     # Middot
    '&amp;': '&',        # Ampersand
    '&lt;': '<',         # Less than
    '&gt;': '>',         # Greater than
    '&#8209;': '-',      # Non-breaking hyphen
    '&#8211;': '-',      # En dash (numeric)
    '&#8212;': '-',      # Em dash (numeric)
}

ПРИМЕР:
Input:  "+7&nbsp;(831)&nbsp;262-16-42"
Output: "+7 (831) 262-16-42"
```

---

## 4. Email Garbage Patterns

```python
GARBAGE_PATTERNS = [
    r'^test[._-]?',       # test, test_, test-
    r'^example[._-]?',    # example, example_, example-
    r'^noreply',          # noreply
    r'^no-?reply',        # no-reply, noreply
    r'^donotreply',       # donotreply
    r'^invalid',          # invalid
    r'^placeholder',      # placeholder
]

ИСКЛЮЧАЮТСЯ (local part email):
❌ test@example.com
❌ test_123@domain.ru
❌ example.mail@test.io
❌ noreply@company.com
❌ no-reply@domain.io

ДОПУСКАЮТСЯ:
✅ info@example.com
✅ contact@company.ru
✅ support@domain.io
```

---

## 5. Phone Validation Logic

```
STEP 1: Remove non-digits
"+(831) 262-16-42" → "83126216 42"

STEP 2: Check length
10-11 digits: OK
<10 digits: REJECT
>11 digits: REJECT

STEP 3: Check format
11 digits:
  ├─ First digit = '7' or '8': OK ✅
  └─ Else: REJECT ❌

10 digits:
  ├─ Any first digit: OK ✅

ПРИМЕРЫ:
✅ "+7 (383) 209-21-27" → "73832092127" (11 digits, starts with 7)
✅ "(812) 250-62-10" → "81225062 10" (10 digits)
❌ "8431 21 13" → "843121 13" (8 digits < 10)
❌ "85786 1 12 1" → "857861121" (9 digits < 10)
```

---

## 6. BFS Priority Order

```
1️⃣  FORCED URLs (highest priority)
    ├─ https://domain.com/contact
    ├─ https://domain.com/contacts
    ├─ https://domain.com/about
    └─ https://domain.com/team
    ACTION: Добавляются в FRONT очереди (appendleft)

2️⃣  PRIORITY 1: Links с 'contact'/'contacts'
    ├─ /my-contact
    ├─ /contact-us
    └─ /get-in-contact
    ACTION: Обработаны в начале

3️⃣  PRIORITY 2: Links с 'about'/'team'
    ├─ /about-us
    ├─ /our-team
    └─ /team-members
    ACTION: Обработаны после приоритета 1

4️⃣  PRIORITY 3: Остальные ссылки
    └─ /products, /blog, /services
    ACTION: Обработаны в конце

5️⃣  DEPTH LIMIT: max_depth = 2
    ACTION: Глубже не идем

6️⃣  PAGE LIMIT: max_pages = 10
    ACTION: Более 10 страниц не обрабатываем
```

---

## 7. Filters in Link Extraction

```
FILTER CHAIN:
═════════════════════════════════════════════

Input: href from HTML
  ↓
FILTER 1: Skip query string
  if '?' in href:
    continue ❌
  Примеры пропуска:
    ❌ /contact?page=1
    ❌ /about?utm=source

  ✅ Пропускаются
  ❌ /contact (OK)
  ✅ Проходят

  Почему: /contact?page=1 и /contact?page=2 это одна страница
  ↓

FILTER 2: Same domain
  if urlparse(url).netloc != domain:
    continue ❌
  Примеры пропуска:
    ❌ https://other-site.com
    ❌ https://cdn.example.com (другой домен)

  ✅ /about (OK, same domain)
  ✅ https://example.com/products (OK)
  ✅ Проходят
  ↓

FILTER 3: Not visited
  if url in visited:
    continue ❌
  ↓

FILTER 4: Not in queue
  if url in queue:
    continue ❌
  ↓

FILTER 5: Depth limit
  if current_depth + 1 > max_depth:
    continue ❌
  ↓

FILTER 6: Priority URL already added
  if 'contact' or 'about' in url:
    continue ❌
    (уже добавлена как forced URL)
  ↓

✅ PASS ALL FILTERS
queue.append((url, depth + 1))
```

---

## 8. Crawl Config Parameters

```python
CrawlerRunConfig(
    wait_until="networkidle",           # Ждем завершения всех сетевых запросов
    page_timeout=30000,                 # 30 секунд на загрузку
    word_count_threshold=5,              # Минимум 5 слов для обработки
    scan_full_page=True,                 # Сканируем весь page
    remove_overlay_elements=True,        # Удаляем модальные окна
    process_iframes=True,                # Обрабатываем iframe'ы
)
```

---

## 9. Data Structure

### all_emails (Dictionary)

```python
all_emails = {
    "info@example.com": "https://example.com",
    "contact@example.com": "https://example.com/contact",
    "support@example.com": "https://example.com/support",
}

Используется для:
1. Dedup (check: email_clean not in all_emails)
2. Storage (email как key, source_url как value)
3. Final result (convert to list with source_page)
```

### all_phones (Dictionary)

```python
all_phones = {
    "83126216 42": {
        "original": "+7 (831) 262-16-42",
        "source": "https://example.com"
    },
    "89123456789": {
        "original": "8 (912) 345-67-89",
        "source": "https://example.com/contact"
    },
}

Используется для:
1. Dedup key (normalized: без +7, только цифры)
2. Storage (normalized как key, original + source как value)
3. Final result (convert to list with source_page)
```

### Queue Structure

```python
queue = deque([
    ("https://example.com", 0),           # (url, depth)
    ("https://example.com/contact", 1),
    ("https://example.com/about", 1),
    ("https://example.com/products", 1),
])

Операции:
- queue.popleft() → получить первый элемент (FIFO)
- queue.append((url, depth)) → добавить в конец (низкий приоритет)
- queue.appendleft((url, depth)) → добавить в начало (высокий приоритет)
```

### Visited Set

```python
visited = {
    "https://example.com",
    "https://example.com/contact",
    "https://example.com/about",
}

Используется для:
1. Check: if url in visited (не обрабатывать дважды)
2. Add: visited.add(url) (после обработки)
3. Filter: if url not in visited (при добавлении в queue)
```

---

## 10. Extraction Passes

```
PASS 1: Tel Links (HIGHEST PRIORITY)
═══════════════════════════════════════════
Source: result.html
Regex: r'href=["\']?tel:([^"\'>\s]+)'
Validation: _is_valid_phone() + len(normalized) >= 7
Dedup: DISABLED (accept all)
Output: all_phones

PASS 2: Markdown
═══════════════════════════════════════════
Source: result.markdown
Emails:
  - Regex 1: r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
  - Regex 2: r'href=["\']?mailto:([^"\'>\s]+)'
  - Regex 3 (aggressive): r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}'
Phones:
  - _extract_phones_from_text() (3 patterns)
Validation: Email garbage check, phone _is_valid_phone()
Dedup: ENABLED for email, DISABLED for phone

PASS 3: Cleaned Content
═══════════════════════════════════════════
Source: result.cleaned_content
(Same as PASS 2)

PASS 4: Cleaned HTML
═══════════════════════════════════════════
Source: result.cleaned_html
(Same as PASS 2)

PASS 5: Raw HTML
═══════════════════════════════════════════
Source: result.html
(Same as PASS 2)

PASS 6: Tables
═══════════════════════════════════════════
Source: result.tables (array of tables)
For each cell in table:
  - Extract emails and phones (same regex)
  - Apply validation
  - Store in all_emails, all_phones
```

---

## 11. Post-Processing Flow

```
STEP 1: Format Phones
────────────────────────
Input: all_phones dict
all_phones = {
    "83126216 42": {"original": "+7 (831) 262-16-42", "source": "https://..."},
    ...
}

Output: phones_list
phones_list = [
    {"phone": "+7 (831) 262-16-42", "source_page": "https://..."},
    ...
]

STEP 2: Format Emails
────────────────────────
Input: all_emails dict
all_emails = {
    "info@example.com": "https://example.com",
    ...
}

Output: emails in result
"emails": [
    {"email": "info@example.com", "source_page": "https://example.com"},
    ...
]

STEP 3: Sort
────────────────────────
Emails: sorted(all_emails.items()) → alphabetically
Phones: sorted(all_phones.items()) → by normalized key

STEP 4: Slice (CUT OFF)
────────────────────────
emails[:10]     # максимум 10
phones[:10]     # максимум 10
sources[:10]    # максимум 10
```

---

## 12. Fallback Crawler Trigger

```
WHEN TO ACTIVATE:
╔═══════════════════════════════════════════╗
║ if crawl4ai_failed and len(sources) == 0: ║
╚═══════════════════════════════════════════╝

MEANING:
- crawl4ai_failed = True  → Crawl4AI сломался на первой странице
- len(sources) == 0       → Никаких источников не получено

EXAMPLE:
crawl4ai_failed = True (Crawl4AI вернул None на первой странице)
sources = {}  (set пуст, ничего не добрал)
→ Activate fallback crawler!

FALLBACK PARAMETERS:
- Max pages: 5 (vs 10 in main)
- Max depth: 2 (same)
- Timeout: 10 sec (requests, vs 30 for Crawl4AI)
- Method: requests.get() instead of AsyncWebCrawler
- Forced URLs: Same 4 as main (/contact, /contacts, /about, /team)
```

---

## 13. Exact Status Per Site Values

```python
status_per_site = {
    "https://example.com": "success",              # Crawl4AI успешно
    "https://example.com/contact": "success",      # Crawl4AI успешно
    "https://example.com/about": "fetch_failed",   # Crawl4AI ошибка
    "https://example.com/team": "fallback_success", # Fallback успешно
    "https://example.com/products": "fallback_failed", # Fallback ошибка
}

Возможные значения:
- "success" → Crawl4AI успешно обработал
- "fetch_failed" → Crawl4AI сломался
- "fallback_success" → Fallback crawler успешно обработал
- "fallback_failed" → Fallback crawler не смог
```

---

## 14. Common Mistakes to Avoid

```
❌ MISTAKE 1: Checking phone dedup
    if normalized not in all_phones:
        all_phones[normalized] = ...
→ Это закомментировано! DEDUP ОТКЛЮЧЕНА для phone!

❌ MISTAKE 2: Using result.cleaned_text
    text = result.cleaned_text  # ← DOESN'T EXIST!
→ Используй result.html, result.cleaned_html, result.markdown

❌ MISTAKE 3: Accessing link as string
    for link in result.links["internal"]:
        url = link.split('#')[0]  # ← link это DICT, не string!
→ Используй link.get("href")

❌ MISTAKE 4: Not normalizing HTML entities
    phones = extract_phones(html)  # &nbsp; не нормализирована
→ Используй _normalize_html_entities() перед regex

❌ MISTAKE 5: Matching email without garbage check
    all_emails[email] = source_url  # "test@domain.com" попадет!
→ Проверь is_garbage = any(re.match(pattern, email_clean.split('@')[0]))

❌ MISTAKE 6: Not checking depth before adding to queue
    queue.append((url, current_depth + 1))  # depth может быть > max_depth
→ Проверь if current_depth + 1 > self.max_depth: continue

❌ MISTAKE 7: Not removing query strings
    queue.append((url_with_params, depth))  # Создает дубликаты
→ Удали query: normalized_url = normalized_url.split('?')[0]
```

---

## 15. Performance Characteristics

```
TYPICAL EXTRACTION:
═════════════════════════════════════════════

Domain: https://example.com
Max pages: 10
Max depth: 2

TIME:
- Page fetch: ~3-5 seconds each (wait_until="networkidle")
- Extraction: ~100-200ms per page
- Traversal: ~50ms per page
Total: 10 pages × 4 seconds = ~40 seconds

CONTACTS FOUND:
- Emails: 2-10 per site (max 10 in result)
- Phones: 1-5 per site (max 10 in result)
- Sources: 3-10 pages crawled (max 10 in result)

DEDUP STATS:
- Email dedup: ENABLED → unique emails in all_emails
- Phone dedup: DISABLED → may have duplicates in result

COMMON ISSUES:
- Crawl4AI timeout on heavy sites → fallback to requests
- JavaScript-rendered contacts → won't capture (Crawl4AI waits for networkidle)
- PDF/document links → filtered out (only .html or no extension)
- External links → filtered out (same domain check)
```

---

**Версия: v3.0**
**Последнее обновление: 2026-03-18**
