# LeadExtractor Backend v3.0 - Полная Документация

## 📋 Обзор

Этот набор документов содержит **полный анализ и описание** backend кода LeadExtractor для извлечения контактов (email, телефоны) с веб-сайтов.

**Общий объем:** ~140 KB, ~3500 строк анализа
**Версия:** v3.0 (текущая)
**Дата анализа:** 2026-03-18

---

## 📚 Документы

### 1. **BACKEND_ANALYSIS.md** (58 KB, 1770 строк)

**Для:** Детального изучения и понимания архитектуры

**Содержит:**

```
1.  CRAWLING PIPELINE
    └─ Инициализация, основной flow, fallback механизм

2.  BFS ЛОГИКА
    ├─ Формирование очереди [(url, depth)]
    ├─ Dedupe логика с примерами
    ├─ Нормализация URL (split # и ?)
    └─ Все regex для ссылок (5 patterns)

3.  EXTRACTION PIPELINE
    ├─ PASS 1: tel: links
    ├─ PASS 2-4: Email + Phone (markdown, cleaned_content, cleaned_html, html)
    ├─ PASS 5: Table extraction
    ├─ Все regex patterns с примерами
    └─ Порядок источников (markdown → cleaned_content → cleaned_html → html)

4.  PHONE EXTRACTION
    ├─ 4.1 ВСЕ REGEX PATTERNS (3 patterns, все полностью)
    ├─ 4.2 NORMALIZATION (3 функции: entities, extension, dedup)
    ├─ 4.3 VALIDATION (10-11 digits, starts with 7 or 8)
    └─ 4.4 DEDUP (DISABLED = ВАЖНО!)

5.  EMAIL EXTRACTION
    ├─ Все regex patterns (3 variants)
    ├─ Garbage filter patterns (7 patterns)
    └─ Логика dedup (ENABLED)

6.  POST-PROCESSING
    ├─ Трансформация результатов
    ├─ Slicing (max 10 каждого)
    └─ Sorting (alphabetically for email, by key for phone)

7.  СКРЫТЫЕ ЭВРИСТИКИ
    ├─ Все IF условия из кода
    ├─ Приоритизация links (3 уровня)
    ├─ Forced URLs логика (4 URL: /contact, /contacts, /about, /team)
    └─ CrawlerRunConfig settings (7 параметров)

8.  ТОЧКИ ПОТЕРИ КАЧЕСТВА
    ├─ RECALL LOSS (пропущенные контакты)
    │  └─ HTML entities 35-40% (SOLVED)
    │  └─ Extensions 15-20% (SOLVED)
    │  └─ Too short numbers 5-10%
    │  └─ Query string filtering 5-10%
    └─ PRECISION LOSS (ложные позитивы)
       └─ Broad phone regex 5-15%
       └─ Email garbage filter 1-5%
       └─ Aggressive email extraction 1-3%
       └─ Disabled phone dedup (high - intentional)

9.  FLOW ДИАГРАММА
    ├─ Полный path INPUT → OUTPUT
    ├─ Все промежуточные шаги
    ├─ Все regex и условия в потоке
    └─ Traversal flow с 6 filters

10. РЕЗЮМЕ
    ├─ Архитектура в одной таблице
    ├─ Все regex patterns в таблице
    └─ Ключевые параметры в таблице
```

**Когда использовать:** Когда нужно **понять как это работает**

---

### 2. **QUICK_REFERENCE.md** (18 KB, 1100 строк)

**Для:** Быстрого поиска информации при разработке

**Содержит:**

```
1.  Инициализация класса (пример, output)
2.  Все Regex Patterns с примерами ловит/не ловит
3.  HTML Entity Normalization (таблица 11 replacements)
4.  Email Garbage Patterns (что исключается)
5.  Phone Validation Logic (пошаговая)
6.  BFS Priority Order (диаграмма 6 уровней)
7.  Filters in Link Extraction (весь filter chain)
8.  Crawl Config Parameters (все опции с объяснениями)
9.  Data Structures (примеры all_emails, all_phones, queue)
10. Extraction Passes (таблица PASS 1-6)
11. Post-Processing Flow (фазы с примерами)
12. Fallback Crawler Trigger (когда и почему)
13. Status Per Site Values (возможные значения)
14. Common Mistakes (7 частых ошибок с объяснениями)
15. Performance Characteristics (timing и expectations)
```

**Когда использовать:** Когда нужно **быстро найти конкретную информацию**

---

### 3. **IMPLEMENTATION_CHECKLIST.md** (17 KB, 550 строк)

**Для:** Пошагового выполнения при разработке

**Содержит:**

```
Phase 1:  Project Setup (dependencies, structure)
Phase 2:  Crawl4AIClient Class (14 методов с checkboxes)
Phase 3:  Extraction Pipeline (PASS 1-5)
Phase 4:  Traversal Logic (forced URLs, filters)
Phase 5:  Fetch Page (async, CrawlerRunConfig)
Phase 6:  Fallback Crawler (BFS loop)
Phase 7:  Main Extract Method (init, loop, post-processing)
Phase 8:  FastAPI Integration (models, endpoints)
Phase 9:  Testing (unit, integration, API, edge cases)
Phase 10: Logging & Debugging (setup, debug points)
Phase 11: Performance Optimization (caching, limits)
Phase 12: Deployment (requirements.txt, Docker)

+ Verification Checklist (features, code quality, behavior)
+ Success Criteria (measurable outcomes)
```

**Когда использовать:** Когда **разрабатываешь код** (отмечай checkboxes)

---

### 4. **DOCUMENTS_SUMMARY.txt** (12 KB)

**Для:** Обзора всех документов

**Содержит:**
- Описание каждого документа
- Как их использовать
- Ключевые особенности кода
- Версии и параметры

---

## 🎯 Быстрый Старт

### Если нужно **переписать весь backend**:

1. Прочитай **BACKEND_ANALYSIS.md** (раздел 1-9)
   - Поймешь архитектуру
   - Узнаешь все особенности

2. Используй **IMPLEMENTATION_CHECKLIST.md** (Phase 1-12)
   - Следуй пошагово
   - Отмечай выполненное

3. Справляйся в **QUICK_REFERENCE.md**
   - Когда нужно вспомнить regex
   - Когда нужна таблица параметров

### Если нужно **исправить конкретный баг**:

1. Справляйся в **QUICK_REFERENCE.md**
   - Найди конкретный regex
   - Посмотри примеры

2. Проверь в **BACKEND_ANALYSIS.md** (раздел 8)
   - Посмотри "точки потери качества"
   - Найди похожий баг

3. Используй line numbers для поиска в коде

### Если нужно **добавить feature**:

1. Посмотри в **BACKEND_ANALYSIS.md** (раздел 7)
   - Хитрые эвристики
   - Где добавить новую логику

2. Используй **QUICK_REFERENCE.md** (раздел 14)
   - Common mistakes to avoid

3. Обнови **IMPLEMENTATION_CHECKLIST.md**
   - Добавь новый phase

---

## 🔑 Ключевые Концепции

### 3-слойная Архитектура

```
LAYER 1: FETCH
  └─ Получить страницу (Crawl4AI или requests)
  └─ Если error → return None (не ломает traversal)

    ↓

LAYER 2: EXTRACTION
  └─ Извлечь контакты из HTML
  └─ Если error → return empty sets (не ломает traversal)

    ↓

LAYER 3: TRAVERSAL
  └─ Добавить ссылки в queue
  └─ Если error → skip link (продолжи со следующего)
```

**Ключевая идея:** Слои независимы! Ошибка в одном не ломает другие.

### BFS с Приоритизацией

```
Queue содержит: [(url, depth), ...]

Приоритет добавления:
1️⃣  Forced URLs: /contact, /contacts, /about, /team
    └─ Добавляются в FRONT (appendleft) → обработаны первыми

2️⃣  Priority 1: Links с 'contact'/'contacts'
    └─ Обработаны в начале

3️⃣  Priority 2: Links с 'about'/'team'
    └─ Обработаны после Priority 1

4️⃣  Priority 3: Остальные ссылки
    └─ Обработаны в конце

5️⃣  Depth limit: max_depth = 2
    └─ Глубже не идем

6️⃣  Page limit: max_pages = 10
    └─ Более 10 страниц не обрабатываем
```

### Multi-Pass Extraction

```
Pass 1: tel: links (HIGHEST PRIORITY)
Pass 2: markdown (cleanest)
Pass 3: cleaned_content
Pass 4: cleaned_html
Pass 5: raw html
Pass 6: tables

Каждый pass может найти контакты, которые missed другие.
```

### HTML Entity Normalization

```
ПРОБЛЕМА: "+7&nbsp;(831)&nbsp;262-16-42"
  └─ &nbsp; не matches \s в regex
  └─ Regex не находит номер

РЕШЕНИЕ: _normalize_html_entities()
  └─ &nbsp; → ' '
  └─ &ndash; → '-'
  └─ ...
  └─ Теперь regex находит номер ✅

Решает: 35-40% потери контактов
```

### Phone Dedup DISABLED

```
ВАЖНО: Phone deduplication отключена!

Email dedup: ENABLED
  └─ all_emails[email] = source
  └─ Если email существует → не добавляется

Phone dedup: DISABLED
  └─ all_phones[normalized] = {original, source}
  └─ Каждый номер добавляется (даже дубликаты)
  └─ Может быть несколько одинаковых номеров

Результат: Может быть до 10 одинаковых номеров (если на разных страницах)
```

---

## 🧪 Примеры

### Email Regex

```python
# Standard (с word boundaries)
r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'

ЛОВИТ:
✅ info@example.com
✅ contact.person@company.ru

НЕ ЛОВИТ:
❌ test@domain (нет TLD)
❌ @example.com (нет local part)


# Aggressive (без word boundaries - contact pages only)
r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}'

ДОПОЛНИТЕЛЬНО ЛОВИТ:
✅ contact@test.com;
✅ contact@test.com,another@email.com
```

### Phone Regex

```python
# Pattern 1: International format
r'\+\d[\d\s\-\(\)]{8,}\d'

ЛОВИТ:
✅ +7 (831) 262-16-42
✅ +78312621642
✅ +1-555-0000

НЕ ЛОВИТ:
❌ 7-831-262-16-42 (нет +)
❌ +7 123 (слишком коротко)


# Pattern 2: Russian domestic format
r'\b8[\d\s\-\(\)]{8,}\d'

ЛОВИТ:
✅ 8 (831) 262-16-42
✅ 8(831)262-16-42

НЕ ЛОВИТ:
❌ (831) 262-16-42 (нет 8)
❌ +7 (831) 262-16-42 (начинается с +)


# Pattern 3: Parentheses format
r'\(\d{3}\)[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}'

ЛОВИТ:
✅ (831) 262-16-42
✅ (495)123-45-67
✅ (831)-262-16-42
```

### HTML Entity Normalization

```python
def _normalize_html_entities(self, text: str) -> str:
    text = text.replace('&nbsp;', ' ')       # Space
    text = text.replace('&#160;', ' ')       # Numeric space
    text = text.replace('&ndash;', '-')      # En dash
    text = text.replace('&mdash;', '-')      # Em dash
    text = text.replace('&middot;', '-')     # Middot
    text = text.replace('&amp;', '&')        # Ampersand
    text = text.replace('&lt;', '<')         # Less than
    text = text.replace('&gt;', '>')         # Greater than
    text = text.replace('&#8209;', '-')      # Non-breaking hyphen
    text = text.replace('&#8211;', '-')      # En dash (numeric)
    text = text.replace('&#8212;', '-')      # Em dash (numeric)
    return text

ПРИМЕР:
Input:  "+7&nbsp;(831)&nbsp;262-16-42"
Output: "+7 (831) 262-16-42"
```

---

## 📊 Статистика

### Размер Кода
- `main.py`: 127 строк (FastAPI server)
- `crawl4ai_client.py`: 1081 строк (**ОСНОВНОЙ ФАЙЛ**)
- `extraction_schemas.py`: 194 строк
- `extractors.py`: 49 строк

### Параметры
- `timeout`: 30 секунд (на одну страницу)
- `max_pages`: 10 (максимум страниц)
- `max_depth`: 2 (максимальная глубина BFS)
- `max_links_per_page`: 30 (максимум ссылок)
- `email_slice`: :10 (максимум в результате)
- `phone_slice`: :10 (максимум в результате)

### Performance
- Время на страницу: ~4 секунда (wait_until="networkidle")
- Извлечение: ~100-200ms per page
- Traversal: ~50ms per page
- Total для 10 страниц: ~40 секунд

### Контакты
- Emails: 2-10 per site (макс 10 в результате)
- Phones: 1-5 per site (макс 10 в результате)
- Pages crawled: 5-10 (мин 1, макс 10)

---

## ⚠️ Частые Ошибки

1. **Использование `result.cleaned_text`**
   ```python
   ❌ text = result.cleaned_text  # Doesn't exist!
   ✅ text = result.html or result.cleaned_html or result.markdown
   ```

2. **Доступ к link как к строке**
   ```python
   ❌ href = link.split('#')[0]  # link это dict!
   ✅ href = link.get("href")
   ```

3. **Не нормализирование HTML entities**
   ```python
   ❌ phones = extract_phones(html)
   ✅ html_norm = _normalize_html_entities(html)
      phones = extract_phones(html_norm)
   ```

4. **Email деdup но без garbage check**
   ```python
   ❌ all_emails[email] = source  # "test@domain.com" попадет!
   ✅ if not is_garbage and email not in all_emails:
         all_emails[email] = source
   ```

5. **Забыли про phone dedup DISABLED**
   ```python
   # Phone dedup закомментирована в коде!
   # Это intentional - для максимума recall
   # Но результаты могут содержать дубли
   ```

---

## 🔗 Файлы Проекта

```
/home/user/ai/
├── BACKEND_ANALYSIS.md              (58 KB) - Детальный анализ
├── QUICK_REFERENCE.md               (18 KB) - Справочник
├── IMPLEMENTATION_CHECKLIST.md       (17 KB) - Checklist
├── DOCUMENTS_SUMMARY.txt            (12 KB) - Обзор документов
├── README_DOCS.md                   (этот файл)
│
└── LeadExtractor/backend/
    ├── main.py
    ├── crawl4ai_client.py            (1081 строк - ГЛАВНЫЙ ФАЙЛ)
    ├── extraction_schemas.py
    ├── extractors.py
    ├── test_crawler.py
    └── test_bfs.py
```

---

## ✅ Готово к Использованию

После прочтения этих документов вы сможете:

✓ Понять полную архитектуру системы
✓ Переписать каждый метод точно как в оригинале
✓ Реализовать все regex patterns правильно
✓ Избежать всех хитрых ошибок
✓ Настроить валидацию корректно
✓ Реализовать BFS с правильной приоритизацией
✓ Добавить fallback crawler
✓ Интегрировать с FastAPI
✓ Настроить логирование и отладку
✓ Развернуть в production

---

**Версия:** v3.0 (Current)
**Дата:** 2026-03-18
**Язык:** Russian
**Статус:** ✅ Полный анализ завершен
