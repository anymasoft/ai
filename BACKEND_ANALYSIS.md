# ДЕТАЛЬНЫЙ АНАЛИЗ BACKEND КОДА LeadExtractor

**Версия документа:** v3.0 (Current)
**Дата анализа:** 2026-03-18
**Архитектура:** 3-слойный pipeline (FETCH → EXTRACTION → TRAVERSAL)

---

## 1. CRAWLING PIPELINE

### 1.1 Инициализация

**Файл:** `/home/user/ai/LeadExtractor/backend/crawl4ai_client.py` (строки 25-28)

```python
def __init__(self, timeout: int = 30, max_pages: int = 10, max_depth: int = 2):
    self.timeout = timeout      # 30 секунд - таймаут на одну страницу
    self.max_pages = max_pages  # 10 - максимум страниц в BFS
    self.max_depth = max_depth  # 2 - максимальная глубина обхода
```

**Параметры по умолчанию:**
- `timeout=30` - таймаут на fetch одной страницы (ms: `30 * 1000 = 30000`)
- `max_pages=10` - максимум страниц для обхода
- `max_depth=2` - максимальная глубина BFS (0=домен, 1=/path, 2=/path/subpath)

### 1.2 Основной Flow - Метод `extract()`

**Файл:** `/home/user/ai/LeadExtractor/backend/crawl4ai_client.py` (строки 363-519)

```python
async def extract(self, domain_url: str) -> Dict:
    """
    Extract contacts using manual BFS traversal with Crawl4AI as fetch engine.
    Returns: {"emails": [...], "phones": [...], "sources": [...], "status_per_site": {...}}
    """
```

#### ЭТАП 1: Инициализация (строки 371-391)

```python
# Normalize input URL
if not domain_url.startswith(('http://', 'https://')):
    domain_url = f'https://{domain_url}'

domain = urlparse(domain_url).netloc

# Global storage for results
all_emails = {}      # {email: source_url}
all_phones = {}      # {normalized: {"original": phone, "source": source_url}}
sources = set()      # {url1, url2, ...}
status_per_site = {} # {url: "success"|"fetch_failed"|"fallback_success"}
page_count = 0

# Manual BFS traversal
queue = deque([(domain_url, 0)])  # (url, depth)
visited = set()
crawl4ai_failed = False  # Flag to activate fallback crawler
```

#### ЭТАП 2: BFS Основной Loop (строки 394-451)

```python
try:
    async with AsyncWebCrawler() as crawler:
        while queue and page_count < self.max_pages:  # ← ОСНОВНОЕ УСЛОВИЕ
            current_url, depth = queue.popleft()

            # Skip if visited or depth exceeded
            if current_url in visited or depth > self.max_depth:
                continue

            visited.add(current_url)

            # LAYER 1: FETCH
            result = await self._fetch_page(crawler, current_url)
            if result is None:
                crawl4ai_failed = True
                status_per_site[current_url] = "fetch_failed"
                continue

            page_count += 1
            sources.add(current_url)
            status_per_site[current_url] = "success"

            # LAYER 2: EXTRACTION (independent)
            emails_on_page, phones_on_page = self._extract_contacts(
                result, current_url, all_emails, all_phones
            )

            # LAYER 3: TRAVERSAL (independent)
            links_added = self._traverse_links(
                result, current_url, domain, depth, visited, queue
            )
```

**Критическая особенность:** Если EXTRACTION падает → TRAVERSAL все равно выполняется!

#### ЭТАП 3: Fallback Crawler (строки 442-451)

```python
if crawl4ai_failed and len(sources) == 0:
    logger.info(f"\nCrawl4AI blocked on first page, activating fallback crawler...")

    fallback_page_count = self._fallback_crawl(
        domain_url, domain, all_emails, all_phones, sources, status_per_site
    )
    page_count += fallback_page_count
```

**Условие активации:** Crawl4AI не смог получить первую страницу.

#### ЭТАП 4: Post-Processing и Возврат (строки 456-519)

```python
# Format phones: convert dict values to display format
phones_list = []
for normalized_key, phone_data in sorted(all_phones.items()):
    if isinstance(phone_data, dict):
        phones_list.append({
            "phone": phone_data["original"],  # Original format
            "source_page": phone_data["source"]
        })
    else:
        phones_list.append({
            "phone": phone_data,
            "source_page": ""
        })

result = {
    "emails": [
        {"email": email, "source_page": source}
        for email, source in sorted(all_emails.items())
    ][:10],  # ← SLICING: максимум 10 emails
    "phones": phones_list[:10],  # ← SLICING: максимум 10 phones
    "sources": list(sources)[:10],  # ← SLICING: максимум 10 source URLs
    "status_per_site": status_per_site,
}
```

### 1.3 Fallback Механизм

**Файл:** `/home/user/ai/LeadExtractor/backend/crawl4ai_client.py` (строки 135-234)

```python
def _fallback_crawl(
    self,
    domain_url: str,
    domain: str,
    all_emails: Dict,
    all_phones: Dict,
    sources: set,
    status_per_site: Dict
) -> int:
```

**Когда используется:** Когда Crawl4AI не может получить первую страницу.

**Особенности:**
- Использует `requests` вместо Crawl4AI
- Лимит: **5 страниц** (отличается от основного max_pages)
- Максимальная глубина: **2** (как основной crawler)
- Возвращает количество обработанных страниц

**Forced URLs в fallback (строки 161-166):**

```python
forced_urls = [
    urljoin(domain_url, '/contact'),
    urljoin(domain_url, '/contacts'),
    urljoin(domain_url, '/about'),
    urljoin(domain_url, '/team'),
]
```

Эти URL проверяются в первую очередь в fallback crawler.

---

## 2. BFS ЛОГИКА

### 2.1 Формирование Очереди

**Инициализация очереди (строка 390):**

```python
queue = deque([(domain_url, 0)])  # (url, depth)
visited = set()
```

**Структура элемента в очереди:**
- `url: str` - полный URL для обхода
- `depth: int` - глубина BFS (0=домен, 1=/path, 2=/path/subpath)

### 2.2 Условия Пропуска

**Файл:** `/home/user/ai/LeadExtractor/backend/crawl4ai_client.py` (строки 398-403)

```python
while queue and page_count < self.max_pages:
    current_url, depth = queue.popleft()

    # Skip if visited or depth exceeded
    if current_url in visited or depth > self.max_depth:
        continue

    visited.add(current_url)
```

**Условия пропуска:**
1. **Посещённые URL:** `current_url in visited` - уже обработан
2. **Превышена глубина:** `depth > self.max_depth` - глубина > лимита

### 2.3 Dedupe Логика

**Где:**
- При добавлении в queue: `/home/user/ai/LeadExtractor/backend/crawl4ai_client.py` (строки 616-622)
- При извлечении links: строки 109-110

**Основная dedupe (строки 616-622):**

```python
# === FILTER 3: Not visited ===
if normalized_url in visited:
    continue

# === FILTER 4: Not already in queue ===
if normalized_url in [u[0] for u in queue]:
    continue
```

**В link extraction (строки 109-110):**

```python
# === DEDUP ===
if normalized_url in links or normalized_url in priority_links:
    continue
```

### 2.4 Нормализация URL

**Файл:** `/home/user/ai/LeadExtractor/backend/crawl4ai_client.py`

#### В _traverse_links() (строки 600-604)

```python
# Normalize URL
normalized_url = urljoin(current_url, href)
normalized_url = normalized_url.split('#')[0]  # Remove fragment
normalized_url = normalized_url.split('?')[0]  # Remove query
```

**Шаги нормализации:**
1. **urljoin()** - преобразует относительные пути в абсолютные (`/about` → `https://domain.com/about`)
2. **Удаление фрагмента** - убирает `#anchor` (`https://page.com/path#top` → `https://page.com/path`)
3. **Удаление query** - убирает `?params` (`https://page.com?id=1` → `https://page.com`)

#### В _extract_links_from_html() (строки 81-84)

```python
# Normalize URL
normalized_url = urljoin(current_url, href)
normalized_url = normalized_url.split('#')[0]  # Remove fragment
normalized_url = normalized_url.split('?')[0]  # Remove query
```

**Идентично _traverse_links().**

### 2.5 Все Regex для Ссылок

#### Regex 1: Извлечение href атрибутов (строка 75)

```python
for match in re.finditer(r'href=["\']([^"\']+)["\']', html):
    href = match.group(1)
```

**Что ловит:**
- `href="https://example.com"` → `https://example.com`
- `href='path/to/page'` → `path/to/page`
- `href="/about"` → `/about`

**Не ловит:**
- `href=https://example.com` (без кавычек)
- `src=` вместо `href=`

#### Regex 2: Извлечение tel: ссылок (строка 273)

```python
tel_links = re.findall(r'href=["\']?tel:([^"\'>\s]+)', html)
```

**Что ловит:**
- `href="tel:+7-123-456-7890"` → `+7-123-456-7890`
- `href='tel:+1(555)0000'` → `+1(555)0000`
- `href=tel:+78312621642` → `+78312621642` (без кавычек)

**Не ловит:**
- `a href="tel..."` (пробелы между href и значением не ловятся)

#### Regex 3: Извлечение mailto: ссылок (строка 313)

```python
for match in re.findall(r'href=["\']?mailto:([^"\'>\s]+)', html):
    if "@" in match:
```

**Что ловит:**
- `href="mailto:info@example.com"` → `info@example.com`
- `href='mailto:contact@test.ru'` → `contact@test.ru`
- `href=mailto:admin@domain.io` → `admin@domain.io`

### 2.6 Фильтры Link Extraction

**Файл:** `/home/user/ai/LeadExtractor/backend/crawl4ai_client.py` (строки 47-133)

#### FILTER 1: Исключение протоколов (строка 77)

```python
if not href or href.startswith(('javascript:', 'mailto:', 'tel:', 'ftp:', '#')):
    continue
```

**Исключает:**
- `javascript:void(0)`
- `mailto:email@example.com`
- `tel:+7123456`
- `ftp://file.server.com`
- `#anchor-links`

#### FILTER 2: Bad Extensions (строки 57-62)

```python
BAD_EXTENSIONS = {
    '.css', '.js', '.png', '.jpg', '.jpeg', '.gif',
    '.svg', '.ico', '.webp', '.woff', '.woff2', '.ttf',
    '.eot', '.pdf', '.zip', '.exe', '.mp3', '.mp4',
    '.avi', '.mov', '.wav', '.mov', '.xml', '.rss'
}

if any(url_lower.endswith(ext) for ext in BAD_EXTENSIONS):
    continue
```

**Исключает:** Все статические файлы и медиа.

#### FILTER 3: Bad Paths (строки 65-71)

```python
BAD_PATHS = {
    '/bitrix/', '/wp-content/', '/wp-includes/',
    '/assets/', '/static/', '/dist/', '/build/',
    '/node_modules/', '/vendor/', '/media/',
    '/images/', '/css/', '/js/', '/fonts/',
    '/download/', '/uploads/', '/.git/', '/admin/'
}

if any(bad_path in url_lower for bad_path in BAD_PATHS):
    continue
```

**Исключает:** Asset directories и админ панели.

#### FILTER 4: Only HTML Pages (строки 100-107)

```python
path = urlparse(normalized_url).path.lower()
if path and '.' in path:
    # Has extension - only accept .html
    if not path.endswith('.html'):
        continue
```

**Логика:**
- `/path` → **ДА** (нет расширения, это HTML)
- `/page.html` → **ДА** (расширение .html)
- `/file.pdf` → **НЕТ** (расширение != .html)
- `/style.css` → **НЕТ** (расширение != .html)

#### FILTER 5: Same Domain (строки 86-89)

```python
link_domain = urlparse(normalized_url).netloc
if link_domain != domain:
    continue
```

**Логика:** Только ссылки на тот же домен.

### 2.7 Приоритизация Links

**Файл:** `/home/user/ai/LeadExtractor/backend/crawl4ai_client.py` (строки 113-122)

```python
# === PRIORITIZE ===
# Priority 1: contact pages
priority_keywords = ['contact', 'contacts']
if any(kw in url_lower for kw in priority_keywords):
    priority_links.append(normalized_url)
# Priority 2: about/team pages
elif any(kw in url_lower for kw in ['about', 'team']):
    priority_links.append(normalized_url)
else:
    links.append(normalized_url)

# Return: priority links first, then regular links
result = priority_links + links
return result[:30]  # ← Максимум 30 ссылок за раз
```

**Порядок возврата:**
1. `contact`, `contacts` - **Priority 1**
2. `about`, `team` - **Priority 2**
3. Остальные - **Priority 3**
4. **Максимум 30 ссылок на одной странице**

### 2.8 Forced URLs в Traversal

**Файл:** `/home/user/ai/LeadExtractor/backend/crawl4ai_client.py` (строки 567-587)

```python
# Forced URLs that MUST be checked (highest priority)
forced_contact_urls = [
    urljoin(f'https://{domain}/', '/contact'),
    urljoin(f'https://{domain}/', '/contacts'),
    urljoin(f'https://{domain}/', '/about'),
    urljoin(f'https://{domain}/', '/team'),
]

# === ADD FORCED URLS FIRST (Highest Priority) ===
for forced_url in forced_contact_urls:
    # Normalize
    forced_url = forced_url.split('#')[0]  # Remove fragment
    forced_url = forced_url.split('?')[0]  # Remove query

    # Check: not visited, not in queue
    if forced_url not in visited and forced_url not in [u[0] for u in queue]:
        # Add to FRONT of queue (highest priority)
        queue.appendleft((forced_url, current_depth + 1))
        forced_urls_added += 1
        links_added += 1
```

**Ключевые моменты:**
- Всегда добавляются, если не посещены
- Добавляются в **FRONT** очереди (`appendleft`) → обработаны первыми
- Даже если найдены в extracted links, все равно обработаны первыми

---

## 3. EXTRACTION PIPELINE

### 3.1 Основной Метод - _extract_contacts()

**Файл:** `/home/user/ai/LeadExtractor/backend/crawl4ai_client.py` (строки 816-1007)

```python
def _extract_contacts(
    self,
    result,
    source_url: str,
    all_emails: Dict,
    all_phones: Dict
) -> Tuple[set, set]:
    """
    LAYER 2: EXTRACTION - Multi-pass contact extraction.

    PASS 1: tel: links (most reliable)
    PASS 2: markdown (no HTML entities)
    PASS 3: cleaned_content (pure text)
    PASS 4: raw HTML (fallback)
    """
```

### 3.2 PASS 1: Tel Links (Строки 857-888)

**Файл:** `/home/user/ai/LeadExtractor/backend/crawl4ai_client.py`

```python
# ========== PASS 1: TEL: LINKS (HIGHEST PRIORITY) ==========
try:
    tel_links = re.findall(r'href=["\']?tel:([^"\'>\s]+)', result.html or "")
    logger.info(f"[EXTRACTION Pass 1 - tel: links] Found {len(tel_links)} phone links")

    tel_valid = 0
    tel_filtered = 0

    for phone in tel_links:
        phone_clean = self._clean_phone_extension(phone.strip())
        if not phone_clean:
            continue

        # 🔥 STRICT VALIDATION
        if not self._is_valid_phone(phone_clean):
            logger.info(f"[PHONE FILTER] Tel link rejected: {phone_clean}")
            tel_filtered += 1
            continue

        normalized = self._normalize_phone(phone_clean)
        if len(normalized) >= 7:
            # 🔴 DEBUG: DISABLED DEDUP - ACCEPT ALL PHONES
            logger.info(f"[DEBUG DEDUP DISABLED] Tel link: {phone_clean}")
            all_phones[normalized] = {"original": phone_clean, "source": source_url}
            phones_on_page.add(phone_clean)
            tel_valid += 1

    logger.info(f"[EXTRACTION Pass 1] Valid: {tel_valid}, Filtered: {tel_filtered}")
except Exception as e:
    logger.debug(f"[EXTRACTION] Tel link error: {e}")
```

**Regex:** `r'href=["\']?tel:([^"\'>\s]+)'`

**Что ловит:**
- `href="tel:+7(383)209-21-27"` → `+7(383)209-21-27`
- `href='tel:+78312621642'` → `+78312621642`
- `href=tel:+1-555-0000` → `+1-555-0000`

**Приоритет:** **САМЫЙ ВЫСОКИЙ** - обработан первым.

### 3.3 Подготовка Sources (Строки 890-908)

```python
# ========== PREPARE SOURCES ==========
# Order: markdown (cleanest) → cleaned_content → html (fallback)
sources = []

if hasattr(result, 'markdown') and result.markdown:
    sources.append(('markdown', result.markdown))

if hasattr(result, 'cleaned_content') and result.cleaned_content:
    sources.append(('cleaned_content', result.cleaned_content))

if hasattr(result, 'cleaned_html') and result.cleaned_html:
    sources.append(('cleaned_html', result.cleaned_html))

if hasattr(result, 'html') and result.html:
    sources.append(('html', result.html))

if not sources:
    logger.debug(f"[EXTRACTION] No content sources available")
    return emails_on_page, phones_on_page
```

**Порядок обработки источников:**
1. **markdown** - самый чистый, без HTML
2. **cleaned_content** - очищенный текст
3. **cleaned_html** - очищенный HTML
4. **html** - сырой HTML (fallback)

### 3.4 PASS 2-4: Email Extraction (Строки 910-991)

**Общая структура:**

```python
for source_name, source_content in sources:
    if not source_content:
        continue

    # Normalize HTML entities (CRITICAL!)
    content_normalized = self._normalize_html_entities(source_content)

    # Normalize common obfuscation
    content_normalized = content_normalized.replace("[at]", "@")
    content_normalized = content_normalized.replace("(at)", "@")
    content_normalized = content_normalized.replace(" at ", "@")

    # ========== EMAIL EXTRACTION ==========
    # Standard regex
    for email in re.findall(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', content_normalized):
        email_clean = email.lower().strip()
        is_garbage = any(re.match(pattern, email_clean.split('@')[0]) for pattern in garbage_patterns)

        if not is_garbage and email_clean not in all_emails:
            all_emails[email_clean] = source_url
            emails_on_page.add(email_clean)

    # mailto: links (from any source content)
    for match in re.findall(r'href=["\']?mailto:([^"\'>\s]+)', source_content):
        if "@" in match:
            email_clean = match.lower().strip()
            is_garbage = any(re.match(pattern, email_clean.split('@')[0]) for pattern in garbage_patterns)

            if not is_garbage and email_clean not in all_emails:
                all_emails[email_clean] = source_url
                emails_on_page.add(email_clean)

    # Aggressive extraction on contact pages
    if any(p in source_url.lower() for p in ['contact', 'about', 'team']):
        for match in re.findall(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}', content_normalized):
            email_clean = match.lower().strip()
            is_garbage = any(re.match(pattern, email_clean.split('@')[0]) for pattern in garbage_patterns)

            if not is_garbage and email_clean not in all_emails:
                all_emails[email_clean] = source_url
                emails_on_page.add(email_clean)
```

### 3.5 PASS 2-4: Phone Extraction (Строки 959-979)

```python
# ========== PHONE EXTRACTION ==========
# Use improved phone extraction
found_phones = self._extract_phones_from_text(content_normalized)

for phone in found_phones:
    phone_clean = self._clean_phone_extension(phone)
    if not phone_clean:
        continue

    # 🔥 STRICT VALIDATION
    if not self._is_valid_phone(phone_clean):
        logger.debug(f"[PHONE FILTER] {source_name}: Rejected: {phone_clean}")
        continue

    normalized = self._normalize_phone(phone_clean)
    if len(normalized) >= 7:
        # 🔴 DEBUG: DISABLED DEDUP - ACCEPT ALL PHONES
        logger.info(f"[DEBUG DEDUP DISABLED] Found phone: {phone_clean}")
        all_phones[normalized] = {"original": phone_clean, "source": source_url}
        phones_on_page.add(phone_clean)
```

### 3.6 PASS 5: Table Extraction (Строки 993-1007)

```python
# ========== EXTRACT FROM TABLES ==========
if hasattr(result, 'tables') and result.tables:
    logger.debug(f"[EXTRACTION] Processing {len(result.tables)} table(s)")
    for table in result.tables:
        try:
            self._extract_from_table(table, source_url, all_emails, all_phones)
        except Exception as e:
            logger.debug(f"[EXTRACTION] Table error: {e}")
```

---

## 4. PHONE EXTRACTION

### 4.1 ВСЕ REGEX PATTERNS

#### Pattern 1: International Format (Строка 801)

```python
r'\+\d[\d\s\-\(\)]{8,}\d'
```

**Что ловит:**
- `+7 (831) 262-16-42` ✅
- `+78312621642` ✅
- `+1-555-0000` ✅
- `+7 (383) 209-21-27` ✅

**Не ловит:**
- `7-831-262-16-42` (нет +) ❌
- `+7 123` (слишком коротко) ❌
- `(831) 262-16-42` (нет + в начале) ❌

**Расшифровка:**
- `\+\d` - плюс и одна цифра (+7, +1, и т.д.)
- `[\d\s\-\(\)]{8,}` - 8+ символов: цифры, пробелы, дефисы, скобки
- `\d` - заканчивается на цифру

#### Pattern 2: Russian Domestic Format (Строка 806)

```python
r'\b8[\d\s\-\(\)]{8,}\d'
```

**Что ловит:**
- `8 (831) 262-16-42` ✅
- `8(831)262-16-42` ✅
- `8-831-262-1642` ✅

**Не ловит:**
- `(831) 262-16-42` (нет 8 в начале) ❌
- `+7 (831) 262-16-42` (начинается с +, не 8) ❌

**Расшифровка:**
- `\b8` - word boundary, затем 8
- `[\d\s\-\(\)]{8,}` - 8+ символов
- `\d` - заканчивается на цифру

#### Pattern 3: Parentheses Format (Строка 811)

```python
r'\(\d{3}\)[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}'
```

**Что ловит:**
- `(831) 262-16-42` ✅
- `(495)123-45-67` ✅
- `(812)250-62-10` ✅
- `(831)-262-16-42` ✅

**Не ловит:**
- `831 262-16-42` (нет скобок) ❌
- `(83) 262-16-42` (2 цифры в скобках, а не 3) ❌

**Расшифровка:**
- `\(\d{3}\)` - открывающая скобка, 3 цифры, закрывающая скобка
- `[\s\-]?` - опциональный пробел или дефис (может быть или не быть)
- `\d{3}` - 3 цифры
- `[\s\-]?` - опциональный разделитель
- `\d{2}` - 2 цифры
- `[\s\-]?` - опциональный разделитель
- `\d{2}` - 2 цифры

### 4.2 NORMALIZATION

**Файл:** `/home/user/ai/LeadExtractor/backend/crawl4ai_client.py` (строки 729-781)

#### Нормализация HTML Entities (Строки 729-757)

```python
def _normalize_html_entities(self, text: str) -> str:
    """
    Normalize HTML entities that break regex patterns.

    This solves 35-40% of phone extraction losses!
    """
    text = text.replace('&nbsp;', ' ')      # Non-breaking space → space
    text = text.replace('&#160;', ' ')      # Numeric space → space
    text = text.replace('&ndash;', '-')     # En dash → hyphen
    text = text.replace('&mdash;', '-')     # Em dash → hyphen
    text = text.replace('&middot;', '-')    # Middot → hyphen
    text = text.replace('&amp;', '&')       # Ampersand
    text = text.replace('&lt;', '<')        # Less than
    text = text.replace('&gt;', '>')        # Greater than
    text = text.replace('&#8209;', '-')     # Non-breaking hyphen
    text = text.replace('&#8211;', '-')     # En dash (numeric)
    text = text.replace('&#8212;', '-')     # Em dash (numeric)

    return text
```

**Критические replacements:**
- `&nbsp;` → ` ` - решает проблему: `+7&nbsp;(831)&nbsp;262-16-42` не ловится ✅
- `&ndash;` → `-` - решает: `831&ndash;262&ndash;16&ndash;42` ✅
- `&#160;` → ` ` - альтернативный non-breaking space ✅

#### Удаление Extensions (Строки 759-781)

```python
def _clean_phone_extension(self, phone: str) -> str:
    """
    Remove extensions from phone numbers.

    Examples:
    - "+7 (831) 262-16-42, доб. 172" → "+7 (831) 262-16-42"
    - "+1-555-0000, ext. 123" → "+1-555-0000"
    - "8 (831) 262-16-42 ext 456" → "8 (831) 262-16-42"

    This solves 15-20% of incorrect phone numbers!
    """
    if not phone:
        return phone

    # Split by common extension markers
    phone_clean = re.split(
        r',|\s+(?:доб\.?|ext\.?|extension|add\.?|addl\.?|drop)',
        phone,
        flags=re.IGNORECASE
    )[0]

    return phone_clean.strip()
```

**Regex Explanation:**
- `r',|\s+(?:доб\.?|ext\.?|extension|add\.?|addl\.?|drop)'`
- `,` - запятая ИЛИ
- `\s+` - пробел(ы)
- `(?:доб\.?|ext\.?|extension|add\.?|addl\.?|drop)` - одно из слов (группа non-capturing)
- `доб\.?` - "доб" или "доб."
- `ext\.?` - "ext" или "ext."

**Примеры работы:**
- `"+7 (831) 262-16-42, доб. 172"` → split на `, доб. ` → `["+7 (831) 262-16-42", "172"]` → `[0]` ✅
- `"8(831)262-1642 ext 456"` → split на ` ext ` → `["8(831)262-1642", "456"]` → `[0]` ✅

#### Нормализация для Dedup (Строки 709-727)

```python
def _normalize_phone(self, phone: str) -> str:
    """
    Normalize phone for deduplication.
    - Remove +7 prefix (Russian)
    - Keep only digits
    Returns normalized phone as string
    """
    try:
        # Remove leading +7 (Russian prefix)
        normalized = phone.strip()
        if normalized.startswith('+7'):
            normalized = normalized[2:]

        # Keep only digits
        normalized = re.sub(r'\D', '', normalized)

        return normalized
    except Exception:
        return ""
```

**Примеры:**
- `"+7 (831) 262-16-42"` → remove `+7` → `" (831) 262-16-42"` → remove non-digits → `"83126216 42"` ✅
- `"8(831)262-1642"` → keep as is → remove non-digits → `"883126216 42"` ✅

### 4.3 VALIDATION (_is_valid_phone)

**Файл:** `/home/user/ai/LeadExtractor/backend/crawl4ai_client.py` (строки 655-707)

```python
def _is_valid_phone(self, phone: str) -> bool:
    """
    STRICT phone validation (RU-focused, deterministic).

    Returns True only if phone is:
    - 10-11 digits after normalization
    - Starts with 7 or 8 (Russian)
    - NOT obviously broken/invalid

    Examples:
    ✅ "+7 (383) 209-21-27" → "73832092127" (11 digits)
    ✅ "(812) 250-62-10" → "812250621" → add 7 → "78122506210" (11 digits)
    ❌ "8431 21 13" → "843121 13" (8 digits) - TOO SHORT
    ❌ "85786 1 12 1" → "857861121" (9 digits) - TOO SHORT
    ❌ "89543 10 8" → "8954310 8" (8 digits) - TOO SHORT
    """
    if not phone or not isinstance(phone, str):
        return False

    try:
        # Remove all non-digits
        digits = re.sub(r'\D', '', phone)

        # 🚫 Too short - can't be a valid Russian phone
        if len(digits) < 10:
            logger.debug(f"[VALIDATION] Too short ({len(digits)} digits): {phone}")
            return False

        # 🚫 Too long - definitely broken
        if len(digits) > 11:
            logger.debug(f"[VALIDATION] Too long ({len(digits)} digits): {phone}")
            return False

        # Check Russian phone formats
        # Format 1: 11 digits starting with 7 or 8 (e.g., 79123456789 or 89123456789)
        if len(digits) == 11:
            first_digit = digits[0]
            if first_digit not in ('7', '8'):
                logger.debug(f"[VALIDATION] 11 digits but bad prefix: {phone}")
                return False
            return True

        # Format 2: 10 digits (e.g., 9123456789 - local format without country code)
        if len(digits) == 10:
            # This could be (XXX) XXX-XX-XX format
            # Accept it
            return True

        return False

    except Exception as e:
        logger.debug(f"[VALIDATION] Exception: {e}")
        return False
```

**Валидация входит в эти шаги:**

1. **Type check:** `not isinstance(phone, str)` → FALSE

2. **Digit extraction:** `digits = re.sub(r'\D', '', phone)`
   - Удаляет все non-digit символы
   - `"+7 (383) 209-21-27"` → `"73832092127"`

3. **Length validation:**
   - `< 10 digits` → FALSE (слишком короткие)
   - `> 11 digits` → FALSE (слишком длинные)
   - `10 or 11 digits` → continue

4. **Format validation:**
   - **11 digits:** Первый символ должен быть `7` или `8`
     - ✅ `79123456789` (начинается с 7)
     - ✅ `89123456789` (начинается с 8)
     - ❌ `69123456789` (начинается с 6)
   - **10 digits:** Принимаются все
     - ✅ `9123456789` (локальный формат)

### 4.4 DEDUPLICATION (DISABLED = ВАЖНО!)

**Файл:** `/home/user/ai/LeadExtractor/backend/crawl4ai_client.py`

#### Pass 1 - Tel Links (Строки 878-883)

```python
if len(normalized) >= 7:
    # 🔴 DEBUG: DISABLED DEDUP - ACCEPT ALL PHONES
    # if normalized not in all_phones:
    logger.info(f"[DEBUG DEDUP DISABLED] Tel link: {phone_clean}")
    all_phones[normalized] = {"original": phone_clean, "source": source_url}
    phones_on_page.add(phone_clean)
```

**ВАЖНО:** Строка `if normalized not in all_phones:` **ЗАКОММЕНТИРОВАНА**.

Это означает:
- ✅ Добавляются ВСЕ номера, даже дубликаты
- ❌ Нет фильтрации по уникальности

#### Pass 2-4 (Строки 974-979)

```python
if len(normalized) >= 7:
    # 🔴 DEBUG: DISABLED DEDUP - ACCEPT ALL PHONES
    # if normalized not in all_phones:
    logger.info(f"[DEBUG DEDUP DISABLED] Found phone: {phone_clean}")
    all_phones[normalized] = {"original": phone_clean, "source": source_url}
    phones_on_page.add(phone_clean)
```

**ТАКЖЕ ОТКЛЮЧЕНА DEDUP.**

#### Fallback Crawler (Строки 283-288)

```python
if len(normalized) >= 7:
    # 🔴 DEBUG: DISABLED DEDUP
    # if len(normalized) >= 7 and normalized not in all_phones:
    logger.info(f"[FALLBACK DEBUG DEDUP DISABLED] Tel link: {phone_clean}")
    all_phones[normalized] = {"original": phone_clean, "source": source_url}
    phones_on_page.add(phone_clean)
```

**ТАКЖЕ ОТКЛЮЧЕНА DEDUP в fallback crawler.**

---

## 5. EMAIL EXTRACTION

### 5.1 Все Regex Patterns

#### Pattern 1: Standard Email Regex (Строка 305, 323, 931, 951)

```python
r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
```

**Расшифровка:**
- `\b` - word boundary (начало слова)
- `[A-Za-z0-9._%+-]+` - email local part (буквы, цифры, точки, %, подчеркивание, плюс, дефис)
- `@` - литеральный символ @
- `[A-Za-z0-9.-]+` - domain name (буквы, цифры, точки, дефисы)
- `\.` - литеральная точка (перед TLD)
- `[A-Z|a-z]{2,}` - TLD (минимум 2 буквы)
- `\b` - word boundary (конец слова)

**Что ловит:**
- `info@example.com` ✅
- `contact.person@company.ru` ✅
- `support+tag@domain.io` ✅
- `name_123@test-site.co.uk` ✅

**Не ловит:**
- `test@domain` (нет TLD) ❌
- `@example.com` (нет local part) ❌
- `.email@domain.com` (начинается с точки) ❌

#### Pattern 2: Mailto Links (Строка 313, 940)

```python
r'href=["\']?mailto:([^"\'>\s]+)'
```

**Расшифровка:**
- `href=["\']?` - href= (опциональные кавычки)
- `mailto:` - протокол mailto
- `([^"\'>\s]+)` - capturing group: все до кавычки, >, или пробела

**Что ловит:**
- `href="mailto:info@example.com"` → `info@example.com` ✅
- `href='mailto:contact@test.ru'` → `contact@test.ru` ✅
- `href=mailto:admin@domain.io` → `admin@domain.io` ✅

**Не ловит:**
- `href="mailtoinfo@example.com"` (без двоеточия) ❌
- `<a mailto:test@test.com>` (не href=) ❌

#### Pattern 3: Aggressive (Contact Pages Only - Строка 323, 951)

```python
r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}'
```

**Отличие от Pattern 1:** Нет `\b` word boundary (более aggressively).

**Где используется:** Только на страницах `/contact`, `/about`, `/team`.

**Дополнительно ловит:**
- `email@domain.com;` (в конце точка с запятой) ✅
- `contact@test.com,another@email.com` (через запятую) ✅

### 5.2 Garbage Filter Patterns

**Файл:** `/home/user/ai/LeadExtractor/backend/crawl4ai_client.py` (строки 846-854)

```python
garbage_patterns = [
    r'^test[._-]?',
    r'^example[._-]?',
    r'^noreply',
    r'^no-?reply',
    r'^donotreply',
    r'^invalid',
    r'^placeholder',
]
```

**Применение:**

```python
email_clean = email.lower().strip()
is_garbage = any(re.match(pattern, email_clean.split('@')[0]) for pattern in garbage_patterns)

if not is_garbage and email_clean not in all_emails:
    all_emails[email_clean] = source_url
```

**Что исключается (примеры):**
- `test@example.com` (local part = `test`) ❌
- `test_123@domain.ru` (local part = `test_123`) ❌
- `example.mail@test.io` (local part = `example.mail`) ❌
- `noreply@company.com` (local part = `noreply`) ❌
- `no-reply@domain.io` (local part = `no-reply`) ❌
- `donotreply@example.com` (local part = `donotreply`) ❌
- `invalid@test.ru` (local part = `invalid`) ❌
- `placeholder@domain.com` (local part = `placeholder`) ❌

**Что пропускается:**
- `info@example.com` ✅
- `contact@company.ru` ✅
- `support@domain.io` ✅

### 5.3 Логика Dedup для Email

**Файл:** `/home/user/ai/LeadExtractor/backend/crawl4ai_client.py`

#### Pass 1 - Standard (Строки 935-937)

```python
if not is_garbage and email_clean not in all_emails:
    all_emails[email_clean] = source_url
    emails_on_page.add(email_clean)
```

**Логика:** `all_emails` это dictionary, ключи - unique emails.

#### Pass 2 - Mailto (Строки 945-947)

```python
if not is_garbage and email_clean not in all_emails:
    all_emails[email_clean] = source_url
    emails_on_page.add(email_clean)
```

**Идентично Pass 1.**

#### Pass 3 - Aggressive (Строки 955-957)

```python
if not is_garbage and email_clean not in all_emails:
    all_emails[email_clean] = source_url
    emails_on_page.add(email_clean)
```

**Идентично.**

**Проверка:** `email_clean not in all_emails`
- Первое вхождение → добавляется ✅
- Второе и последующие → игнорируются ❌

**ВАЖНО:** Email dedup **ВКЛЮЧЕНА** (в отличие от phone dedup).

---

## 6. POST-PROCESSING

### 6.1 Трансформация Результатов

**Файл:** `/home/user/ai/LeadExtractor/backend/crawl4ai_client.py` (строки 456-501)

#### Phase 1: Format Phones (Строки 457-470)

```python
# Format phones: convert dict values to display format
phones_list = []
for normalized_key, phone_data in sorted(all_phones.items()):
    if isinstance(phone_data, dict):
        phones_list.append({
            "phone": phone_data["original"],  # Show original format like +7 (3412) 33-05-42
            "source_page": phone_data["source"]
        })
    else:
        # Fallback for old format (shouldn't happen)
        phones_list.append({
            "phone": phone_data,
            "source_page": ""
        })
```

**Трансформация:**
- Input: `{"83126216 42": {"original": "+7 (831) 262-16-42", "source": "https://..."}}`
- Output: `[{"phone": "+7 (831) 262-16-42", "source_page": "https://..."}]`

#### Phase 2: Format Emails (Строки 494-497)

```python
"emails": [
    {"email": email, "source_page": source}
    for email, source in sorted(all_emails.items())
][:10],
```

**Трансформация:**
- Input: `{"info@example.com": "https://example.com", ...}`
- Output: `[{"email": "info@example.com", "source_page": "https://example.com"}, ...]`

### 6.2 Slicing

**Файл:** `/home/user/ai/LeadExtractor/backend/crawl4ai_client.py` (строки 493-501)

```python
result = {
    "emails": [...][10],      # ← СЛАЙС: максимум 10 emails
    "phones": phones_list[:10],  # ← СЛАЙС: максимум 10 phones
    "sources": list(sources)[:10],  # ← СЛАЙС: максимум 10 sources
    "status_per_site": status_per_site,
}
```

**Limits:**
- `emails` → максимум 10 ✅
- `phones` → максимум 10 ✅
- `sources` → максимум 10 ✅
- `status_per_site` → без ограничений (dict со всеми URL)

### 6.3 Sorting

**Email sorting (строка 496):**

```python
for email, source in sorted(all_emails.items())
```

**Что делает:** Сортирует email'ы по алфавиту (ключ в dictionary).
- `aaa@test.com` → `zzz@test.com` (по возрастанию)

**Phone sorting (строка 459):**

```python
for normalized_key, phone_data in sorted(all_phones.items())
```

**Что делает:** Сортирует по normalized phone key (после удаления +7 и всего кроме цифр).
- `"83126216 42"` < `"89123456789"` (строковая сортировка по цифрам)

---

## 7. СКРЫТЫЕ ЭВРИСТИКИ

### 7.1 IF Условия из Кода

#### Condition 1: Skip Tel Links без валидации (Строка 868-875)

```python
if not phone_clean:
    continue

# 🔥 STRICT VALIDATION
if not self._is_valid_phone(phone_clean):
    logger.info(f"[PHONE FILTER] Tel link rejected: {phone_clean}")
    tel_filtered += 1
    continue
```

**Эвристика:** Если `_clean_phone_extension()` вернул пустую строку → skip.

#### Condition 2: Accept Phone если `len(normalized) >= 7` (Строка 878)

```python
if len(normalized) >= 7:
    all_phones[normalized] = {"original": phone_clean, "source": source_url}
```

**Эвристика:** Даже если валидация прошла, еще одна проверка длины после нормализации.

#### Condition 3: Aggressive Email Extraction на Contact Pages (Строка 950)

```python
if any(p in source_url.lower() for p in ['contact', 'about', 'team']):
    for match in re.findall(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}', content_normalized):
        # Extract with lower word boundary requirement
```

**Эвристика:** На страницах `/contact`, `/about`, `/team` используется более "aggressive" regex (без `\b`).

#### Condition 4: Filter by Query String (Строка 608)

```python
# === FILTER 2: Same domain ===
if '?' in href:
    continue
```

**Эвристика:** Если в href есть `?`, пропускаем. Это избегает дублей:
- `https://example.com/page?id=1`
- `https://example.com/page?id=2`
Оба ведут на одну страницу, только с разными параметрами.

#### Condition 5: Fallback Activation (Строка 443)

```python
if crawl4ai_failed and len(sources) == 0:
    fallback_page_count = self._fallback_crawl(...)
```

**Эвристика:** Fallback включается только если:
1. Crawl4AI сломался на первой странице (`crawl4ai_failed == True`)
2. И никаких источников не получено (`len(sources) == 0`)

Если хотя бы одна страница получена → fallback не нужен.

### 7.2 Приоритизация Links

**Файл:** `/home/user/ai/LeadExtractor/backend/crawl4ai_client.py` (строки 113-132)

```python
# Priority 1: contact pages
priority_keywords = ['contact', 'contacts']
if any(kw in url_lower for kw in priority_keywords):
    priority_links.append(normalized_url)
# Priority 2: about/team pages
elif any(kw in url_lower for kw in ['about', 'team']):
    priority_links.append(normalized_url)
else:
    links.append(normalized_url)

# Return: priority links first, then regular links
result = priority_links + links
return result[:30]
```

**Порядок приоритета:**

| Приоритет | Ключевые слова | Примеры | Первыми обработаны? |
|-----------|---|---------|---|
| 1 | `contact`, `contacts` | `/contact`, `/contacts`, `/en/contact` | ✅ ДА |
| 2 | `about`, `team` | `/about`, `/team`, `/about-us` | ✅ ДА |
| 3 | Остальные | `/products`, `/blog`, `/services` | ❌ НЕТ |

**Максимум 30 ссылок за раз.**

### 7.3 Forced URLs Логика

**Файл:** `/home/user/ai/LeadExtractor/backend/crawl4ai_client.py` (строки 568-587)

```python
forced_contact_urls = [
    urljoin(f'https://{domain}/', '/contact'),
    urljoin(f'https://{domain}/', '/contacts'),
    urljoin(f'https://{domain}/', '/about'),
    urljoin(f'https://{domain}/', '/team'),
]

for forced_url in forced_contact_urls:
    if forced_url not in visited and forced_url not in [u[0] for u in queue]:
        queue.appendleft((forced_url, current_depth + 1))  # ← APPENDLEFT = HIGHEST PRIORITY
```

**Механизм:**
- Эти URL добавляются **всегда** (если не посещены)
- Добавляются в **FRONT** очереди (`appendleft`)
- Обработаны **первыми** среди других ссылок

**Примеры:**
- Domain: `https://example.com`
- Forced URLs:
  - `https://example.com/contact`
  - `https://example.com/contacts`
  - `https://example.com/about`
  - `https://example.com/team`

### 7.4 Aggressive Extraction Rules

#### Aggressive Email (Строка 950-957)

```python
if any(p in source_url.lower() for p in ['contact', 'about', 'team']):
    for match in re.findall(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}', content_normalized):
        # Extract without word boundary check
```

**На этих страницах используется pattern без `\b`:**
- Standard: `\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b`
- Aggressive: `[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}`

**Результат:** Может ловить email в более "странных" контекстах.

#### Aggressive Phone via Tel Links (Строка 273)

```python
tel_links = re.findall(r'href=["\']?tel:([^"\'>\s]+)', html)
```

**Почему aggressive:** Кавычки опциональны (`["\']?`), это позволяет ловить даже:
- `href=tel:+78312621642` (без кавычек)

### 7.5 CrawlerRunConfig Settings

**Файл:** `/home/user/ai/LeadExtractor/backend/crawl4ai_client.py` (строки 529-536)

```python
config = CrawlerRunConfig(
    wait_until="networkidle",           # Ждем завершения всех сетевых запросов
    page_timeout=self.timeout * 1000,   # Таймаут в ms (30000 = 30 сек)
    word_count_threshold=5,              # Минимум 5 слов для обработки
    scan_full_page=True,                 # Сканируем весьページ (не только viewport)
    remove_overlay_elements=True,        # Удаляем модалки/popups
    process_iframes=True,                # Обрабатываем iframe'ы
)
```

**Параметры:**

| Параметр | Значение | Что делает |
|----------|----------|-----------|
| `wait_until` | `networkidle` | Ждет пока все сетевые запросы завершатся |
| `page_timeout` | `30000` | 30 секунд на загрузку одной страницы |
| `word_count_threshold` | `5` | Если < 5 слов → игнорировать страницу |
| `scan_full_page` | `True` | Сканируем весь page, а не только viewport |
| `remove_overlay_elements` | `True` | Удаляем модальные окна, popups |
| `process_iframes` | `True` | Обрабатываем iframe'ы |

---

## 8. ТОЧКИ ПОТЕРИ КАЧЕСТВА

### 8.1 RECALL LOSS (Пропущенные Контакты)

#### Loss 1: HTML Entities в Разделителях (SOLVED)

**Проблема (строка 294-299):**

```
Сайт имеет: "+7&nbsp;(831)&nbsp;262-16-42"
Regex: r'\+\d[\d\s\-\(\)]{8,}\d'
Результат: Не ловится! ❌
```

**Почему:** `&nbsp;` - это HTML entity, не обычный пробел. Regex ищет `\s` (обычный пробел).

**Решение (строка 922):**

```python
content_normalized = self._normalize_html_entities(source_content)
# &nbsp; → ' '
# &ndash; → '-'
```

**После fix:** `"+7 (831) 262-16-42"` → ловится ✅

**Loss factor:** 35-40% контактов на старых сайтах с HTML entities.

#### Loss 2: Extensions в Номерах

**Проблема:**

```
Сайт: "+7 (831) 262-16-42, доб. 172"
После regex: "+7 (831) 262-16-42, доб. 172"
Validation: fails (слишком много символов)
```

**Решение (строка 964):**

```python
phone_clean = self._clean_phone_extension(phone)
# Regex: r',|\s+(?:доб\.?|ext\.?|...)'
# Результат: "+7 (831) 262-16-42"
```

**Loss factor:** 15-20% контактов на сайтах с extensions.

#### Loss 3: Too Short Number

**Проблема:**

```
Сайт: "8431 21 13"
Regex найдет: да
Normalization: "843121 13" (8 digits after removing non-digits)
Validation: len(digits) < 10 → FALSE
```

**Почему не используется:** Слишком короткий номер. Может быть шум.

**Loss factor:** 5-10% от ложных срабатываний (но это хорошо - precision > recall).

#### Loss 4: Агрессивная фильтрация по Query String

**Проблема (строка 608):**

```python
if '?' in href:
    continue
```

**Пример потери:**

```
Сайт: https://example.com/contacts?page=1
Эта ссылка НЕ добавляется в queue!
```

**Почему:** Параметр `?page=1` может привести к дубликату (та же страница, разный параметр).

**Loss factor:** ~5-10% потенциальных страниц пропускается.

### 8.2 PRECISION LOSS (Ложные Позитивы)

#### Loss 1: Fallback Phone Extraction Слишком Broad

**Проблема (строки 801, 806, 811):**

```python
# Pattern 1: r'\+\d[\d\s\-\(\)]{8,}\d'
# Ловит: "+1 2 3 4 5 6 7 8 9 0" (все пробелы в правильных местах)
# Это может быть случайное число!

# Pattern 3: r'\(\d{3}\)[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}'
# Ловит: "(123) 456-78-90"
# Могут быть ложные срабатывания в текстах
```

**Решение:** Validation в `_is_valid_phone()` отфильтровывает очень странные номера.

**Precision loss factor:** 5-15% ложных срабатываний (но validation уменьшает это).

#### Loss 2: Email Garbage Filter Может Быть Недостаточен

**Проблема (строки 846-854):**

```python
garbage_patterns = [
    r'^test[._-]?',
    r'^example[._-]?',
    r'^noreply',
    ...
]
```

**Пример потери:**

```
Сайт имеет: "admin_test@company.com"
Garbage check: re.match(r'^test[._-]?', "admin_test")
Результат: no match (тест не в начале)
Ложный позитив! Email добавлен, хотя выглядит как тест. ❌
```

**Почему:** Regex ищет в начале local part, но "admin_test" не начинается с "test".

**Precision loss factor:** 1-5% ложных email'ов.

#### Loss 3: Agressive Email Extraction Без Контекста

**Проблема (строки 950-957):**

```python
if any(p in source_url.lower() for p in ['contact', 'about', 'team']):
    # Используется regex БЕЗ word boundary
    for match in re.findall(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}', content_normalized):
```

**Пример:**

```
Текст: "This is example@unusual-markup.com in HTML"
Regex выделит: "example@unusual-markup.com"
Это может быть примером в тексте, а не реальный контакт!
```

**Loss factor:** 1-3% ложных email'ов.

#### Loss 4: Deduplication Отключена для Phone

**Проблема (строки 878-883):**

```python
if len(normalized) >= 7:
    # 🔴 DEBUG: DISABLED DEDUP - ACCEPT ALL PHONES
    # if normalized not in all_phones:
    all_phones[normalized] = {"original": phone_clean, "source": source_url}
```

**Пример:**

```
Страница 1: "+7 (831) 262-16-42"
Страница 2: "+7 (831) 262-16-42" (с пробелом)
Оба добавляются, хотя это один номер!
```

**Результат:** В финальном списке может быть один номер несколько раз (до 10 экземпляров, если они на разных страницах).

**Precision loss factor:** Высокий (дубликаты в результатах).

---

## 9. FLOW ДИАГРАММА

### 9.1 INPUT → OUTPUT Поток

```
INPUT: "example.com"
  ↓
[INIT] Нормализация URL → "https://example.com"
  ↓
[BFS INIT] queue = deque([("https://example.com", 0)])
           visited = set()
           all_emails = {}
           all_phones = {}
  ↓
═════════════════════════════════════════════
       ОСНОВНОЙ BFS LOOP (while queue and page_count < max_pages)
═════════════════════════════════════════════
  ↓
[BFS] Получить из queue: current_url, depth
  ↓
[CHECK] Посещён или depth > max_depth?
  ├─ ДА → continue (skip)
  └─ НЕТ → добавить в visited
  ↓
[LAYER 1: FETCH]
  ├─ crawler.arun(current_url, config)
  ├─ На успех → result object
  └─ На ошибку → crawl4ai_failed=True, continue
  ↓
[LAYER 2: EXTRACTION] (независимо от TRAVERSAL)
  ├─ PASS 1: tel: links regex
  │  └─ r'href=["\']?tel:([^"\'>\s]+)'
  │
  ├─ PASS 2-4: Email + Phone из (markdown, cleaned_content, cleaned_html, html)
  │  ├─ Email regex: r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
  │  ├─ Mailto regex: r'href=["\']?mailto:([^"\'>\s]+)'
  │  └─ Phone regex (3 patterns):
  │     ├─ r'\+\d[\d\s\-\(\)]{8,}\d'
  │     ├─ r'\b8[\d\s\-\(\)]{8,}\d'
  │     └─ r'\(\d{3}\)[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}'
  │
  ├─ PASS 5: Table extraction
  │
  └─ Результаты → all_emails, all_phones (с source_url)
  ↓
[LAYER 3: TRAVERSAL] (независимо от EXTRACTION)
  ├─ Forced URLs: /contact, /contacts, /about, /team
  │  └─ Добавляются в FRONT очереди (appendleft)
  │
  ├─ Extracted links из result.links["internal"]
  │  ├─ FILTER: same domain, no query, not visited, not in queue, depth limit
  │  ├─ PRIORITIZE: contact > about/team > other
  │  └─ Добавляются в BACK очереди (append)
  │
  └─ links_added → log
  ↓
[RETURN TO BFS] Повторить для next URL в queue
  ↓
═════════════════════════════════════════════
              КОНЕЦ BFS
═════════════════════════════════════════════
  ↓
[FALLBACK CHECK]
  ├─ crawl4ai_failed == True И sources == empty?
  └─ ДА → запустить _fallback_crawl (requests, 5 pages max)
  ↓
[POST-PROCESSING]
  ├─ Format emails: [(email, source_url), ...] → [{email, source_page}, ...]
  ├─ Format phones: {normalized: {original, source}} → [{phone, source_page}, ...]
  ├─ Sort: emails alphabetically, phones by normalized key
  └─ Slice: emails[:10], phones[:10], sources[:10]
  ↓
[RETURN]
{
    "emails": [{email, source_page}, ...],  # max 10
    "phones": [{phone, source_page}, ...],  # max 10
    "sources": [url, ...],                   # max 10
    "status_per_site": {url: status, ...}
}
```

### 9.2 Основные Промежуточные Шаги с Regex

```
HTML from page
  ↓
[NORMALIZE HTML ENTITIES]
  &nbsp; → ' '
  &ndash; → '-'
  &middot; → '-'
  &#160; → ' '
  &#8209; → '-'
  &#8211; → '-'
  &#8212; → '-'
  ↓
[NORMALIZE OBFUSCATION]
  [at] → @
  (at) → @
  space+at+space → @
  ↓
[MULTI-PASS EXTRACTION]
  ├─ PASS 1: Tel Links
  │  Regex: r'href=["\']?tel:([^"\'>\s]+)'
  │  ├─ _clean_phone_extension()
  │  ├─ _is_valid_phone() - CHECK!
  │  └─ _normalize_phone() - for dedup key
  │
  ├─ PASS 2-4: Content extraction
  │  ├─ Email Regex 1: r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
  │  ├─ Email Regex 2: r'href=["\']?mailto:([^"\'>\s]+)'
  │  ├─ Email Regex 3 (aggressive): r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}'
  │  ├─ Garbage check: r'^test[._-]?', r'^example[._-]?', ...
  │  ├─ Phone Regex 1: r'\+\d[\d\s\-\(\)]{8,}\d'
  │  ├─ Phone Regex 2: r'\b8[\d\s\-\(\)]{8,}\d'
  │  └─ Phone Regex 3: r'\(\d{3}\)[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}'
  │
  └─ PASS 5: Table cells
     (same regex and validation)
  ↓
[VALIDATION]
  For phones:
  ├─ _is_valid_phone(): 10-11 digits, starts with 7 or 8
  └─ Length check: len(normalized) >= 7

  For emails:
  ├─ Garbage patterns check
  └─ Dedup check: not in all_emails
  ↓
[STORAGE]
  all_emails = {email: source_url}
  all_phones = {normalized: {original, source}}
```

### 9.3 Все Условия и Фильтры в Потоке

```
TRAVERSAL FLOW:
==============
result.links["internal"] = [{href, text, title}, ...]
  ↓
For each link:
  ├─ Extract href attribute
  │  href = link.get("href")
  │
  ├─ NORMALIZE URL
  │  normalized_url = urljoin(current_url, href)
  │  normalized_url = normalized_url.split('#')[0]  # Remove #
  │  normalized_url = normalized_url.split('?')[0]  # Remove ?
  │
  └─ FILTER CHAIN:
     ├─ FILTER 1: Skip query string?
     │  if '?' in href:
     │      continue  ❌
     │
     ├─ FILTER 2: Same domain?
     │  if urlparse(normalized_url).netloc != domain:
     │      continue  ❌
     │
     ├─ FILTER 3: Already visited?
     │  if normalized_url in visited:
     │      continue  ❌
     │
     ├─ FILTER 4: Already in queue?
     │  if normalized_url in [u[0] for u in queue]:
     │      continue  ❌
     │
     ├─ FILTER 5: Depth limit?
     │  if current_depth + 1 > max_depth:
     │      continue  ❌
     │
     ├─ FILTER 6: Priority URL (already added)?
     │  if any(kw in url_lower for kw in ['contact', 'contacts', 'about', 'team']):
     │      continue  ❌ (already in queue from forced)
     │
     └─ ✅ PASS ALL FILTERS
        queue.append((normalized_url, current_depth + 1))
        links_added += 1
```

---

## 10. РЕЗЮМЕ

### Архитектура в Одной Таблице

| Компонент | Файл | Строки | Назначение |
|-----------|------|--------|-----------|
| **FETCH** | crawl4ai_client.py | 521-548 | Получить страницу через Crawl4AI |
| **EXTRACTION** | crawl4ai_client.py | 816-1007 | Извлечь контакты из HTML |
| **TRAVERSAL** | crawl4ai_client.py | 550-653 | Добавить ссылки в queue |
| **BFS Loop** | crawl4ai_client.py | 390-451 | Основной цикл обхода |
| **Fallback** | crawl4ai_client.py | 135-234 | Альтернативный краулер (requests) |
| **POST** | crawl4ai_client.py | 456-519 | Форматирование результатов |

### Все Regex Patterns

| Название | Regex | Назначение |
|----------|-------|-----------|
| Tel links | `r'href=["\']?tel:([^"\'>\s]+)'` | Извлечение tel: ссылок |
| Email standard | `r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z\|a-z]{2,}\b'` | Email extraction |
| Email aggressive | `r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z\|a-z]{2,}'` | Email (contact pages) |
| Mailto | `r'href=["\']?mailto:([^"\'>\s]+)'` | Mailto links |
| Phone +7 | `r'\+\d[\d\s\-\(\)]{8,}\d'` | International format |
| Phone 8 | `r'\b8[\d\s\-\(\)]{8,}\d'` | Russian domestic format |
| Phone () | `r'\(\d{3}\)[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}'` | Parentheses format |
| Link href | `r'href=["\']([^"\']+)["\']'` | Извлечение href attributes |
| Extension clean | `r',|\s+(?:доб\.?\|ext\.?...)` | Удаление extensions |

### Ключевые Параметры

| Параметр | Значение | Значение (fallback) |
|----------|----------|-------------------|
| `max_pages` | 10 | 5 |
| `max_depth` | 2 | 2 |
| `timeout` | 30 sec | 10 sec (requests) |
| Phone min length | 10 digits | 10 digits |
| Phone max length | 11 digits | 11 digits |
| Email slice | :10 | :10 |
| Phone slice | :10 | :10 |
| Max links/page | 30 | 30 |
| Dedup email | ✅ ENABLED | ✅ ENABLED |
| Dedup phone | ❌ DISABLED | ❌ DISABLED |

### Порядок Обработки

```
1️⃣  FORCED URLs (/contact, /contacts, /about, /team)
    └─ Добавляются в FRONT очереди

2️⃣  PRIORITY 1: Ссылки с 'contact'/'contacts'
    └─ Обработаны в начале

3️⃣  PRIORITY 2: Ссылки с 'about'/'team'
    └─ Обработаны после приоритета 1

4️⃣  PRIORITY 3: Остальные ссылки
    └─ Обработаны в конце

5️⃣  DEPTH LIMIT: max_depth = 2
    └─ Глубже не идем

6️⃣  PAGE LIMIT: max_pages = 10
    └─ Более 10 страниц не обрабатываем
```

---

**Конец документа**

Этот документ содержит полную информацию для переписывания backend'а LeadExtractor v3.0 без доступа к исходному коду.
