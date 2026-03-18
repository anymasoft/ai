# IMPLEMENTATION CHECKLIST - LeadExtractor Backend v3.0

## Phase 1: Project Setup

### 1.1 Environment & Dependencies
- [ ] Create Python 3.9+ environment
- [ ] Install dependencies:
  ```
  pip install fastapi uvicorn crawl4ai pydantic requests
  ```
- [ ] Verify imports work:
  ```python
  from crawl4ai import AsyncWebCrawler, CrawlerRunConfig
  from collections import deque
  from urllib.parse import urlparse, urljoin
  import re, asyncio, logging
  ```

### 1.2 Project Structure
- [ ] Create `/backend` directory
- [ ] Create files:
  - [ ] `main.py` - FastAPI server
  - [ ] `crawl4ai_client.py` - Main crawler class
  - [ ] `extraction_schemas.py` - CSS extraction schemas (optional)
  - [ ] `extractors.py` - Legacy extraction functions (optional)

---

## Phase 2: Crawl4AIClient Class Implementation

### 2.1 Class Initialization
```python
class Crawl4AIClient:
    def __init__(self, timeout: int = 30, max_pages: int = 10, max_depth: int = 2):
        self.timeout = timeout
        self.max_pages = max_pages
        self.max_depth = max_depth
```
- [ ] Implement `__init__()` with 3 parameters
- [ ] Verify parameter types and defaults

### 2.2 Fallback Fetch (Non-Async)
```python
def _fallback_fetch(self, url: str) -> str:
    # Returns HTML string or empty string on error
```
- [ ] Implement HTTP GET with requests
- [ ] User-Agent header (Chrome 120)
- [ ] Timeout 10 seconds
- [ ] Return text or empty string
- [ ] Log errors with logger.debug()

### 2.3 HTML Entity Normalization
```python
def _normalize_html_entities(self, text: str) -> str:
    # Replace 11 HTML entities
```
- [ ] Replace `&nbsp;` with space
- [ ] Replace `&#160;` with space
- [ ] Replace `&ndash;` with `-`
- [ ] Replace `&mdash;` with `-`
- [ ] Replace `&middot;` with `-`
- [ ] Replace `&amp;`, `&lt;`, `&gt;`
- [ ] Replace `&#8209;`, `&#8211;`, `&#8212;` with `-`
- [ ] Return normalized text

### 2.4 Phone Extension Cleaning
```python
def _clean_phone_extension(self, phone: str) -> str:
    # Remove ", доб. 123" type extensions
```
- [ ] Regex pattern: `r',|\s+(?:доб\.?|ext\.?|extension|add\.?|addl\.?|drop)'`
- [ ] Split and take first part [0]
- [ ] Strip whitespace
- [ ] Return cleaned phone string

### 2.5 Phone Validation (STRICT)
```python
def _is_valid_phone(self, phone: str) -> bool:
    # Check 10-11 digits, starts with 7 or 8 (Russian)
```
- [ ] Check type: not string → False
- [ ] Extract digits: `re.sub(r'\D', '', phone)`
- [ ] Check length: 10-11 digits only
- [ ] Check format:
  - [ ] 11 digits: first digit must be '7' or '8'
  - [ ] 10 digits: accept any
- [ ] Log rejects with logger.debug()
- [ ] Return boolean

### 2.6 Phone Normalization
```python
def _normalize_phone(self, phone: str) -> str:
    # Remove +7 prefix, keep only digits
```
- [ ] Remove leading `+7`
- [ ] Remove all non-digits: `re.sub(r'\D', '')`
- [ ] Return normalized string
- [ ] Exception handler: return ""

### 2.7 Phone Extraction from Text
```python
def _extract_phones_from_text(self, text: str) -> List[str]:
    # Use 3 regex patterns
```
- [ ] Pattern 1: `r'\+\d[\d\s\-\(\)]{8,}\d'` (international)
- [ ] Pattern 2: `r'\b8[\d\s\-\(\)]{8,}\d'` (Russian 8)
- [ ] Pattern 3: `r'\(\d{3}\)[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}'` (parentheses)
- [ ] Return list of found phones

### 2.8 Link Extraction from HTML
```python
def _extract_links_from_html(self, html: str, current_url: str, domain: str) -> List[str]:
```
- [ ] Extract all href values: `r'href=["\']([^"\']+)["\']'`
- [ ] Initialize: BAD_EXTENSIONS set, BAD_PATHS set
- [ ] Initialize: priority_links, links lists
- [ ] For each href:
  - [ ] Skip: javascript, mailto, tel, ftp, #
  - [ ] Normalize URL: urljoin + split # and ?
  - [ ] Filter 1: same domain check
  - [ ] Filter 2: skip bad extensions
  - [ ] Filter 3: skip bad paths
  - [ ] Filter 4: only HTML pages (no extension or .html)
  - [ ] Filter 5: dedup in priority_links and links
  - [ ] Filter 6: prioritize contact/about/team
- [ ] Return: priority_links + links, max 30

### 2.9 Extract from Table
```python
def _extract_from_table(self, table: Dict, source_url: str, all_emails: Dict, all_phones: Dict) -> None:
```
- [ ] Get rows from table: `table.get("rows", [])`
- [ ] For each row (handle list and dict formats)
- [ ] For each cell:
  - [ ] Normalize HTML entities
  - [ ] Extract emails: `r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}\b'`
  - [ ] Extract phones: call `_extract_phones_from_text()`
  - [ ] Validate phones
  - [ ] Store in all_emails, all_phones
- [ ] Log results

---

## Phase 3: Extraction Pipeline

### 3.1 Main Extract Contacts Method
```python
def _extract_contacts(self, result, source_url: str, all_emails: Dict, all_phones: Dict) -> Tuple[set, set]:
```
- [ ] Initialize garbage_patterns list (7 patterns)
- [ ] Try-catch wrapper for all extraction

### 3.2 PASS 1: Tel Links
- [ ] Regex: `r'href=["\']?tel:([^"\'>\s]+)'` on result.html
- [ ] For each phone:
  - [ ] Clean extension: `_clean_phone_extension()`
  - [ ] Validate: `_is_valid_phone()`
  - [ ] Normalize: `_normalize_phone()`
  - [ ] Check: `len(normalized) >= 7`
  - [ ] Store: `all_phones[normalized] = {"original": phone_clean, "source": source_url}`
  - [ ] Add to phones_on_page set
- [ ] Log pass result

### 3.3 PASS 2-4: Multi-Source Extraction
- [ ] Prepare sources list:
  - [ ] markdown (if exists)
  - [ ] cleaned_content (if exists)
  - [ ] cleaned_html (if exists)
  - [ ] html (if exists)
- [ ] For each source:
  - [ ] Normalize HTML entities
  - [ ] Replace obfuscation: [at] → @, (at) → @, space-at-space → @
  - [ ] Email Extraction 1: standard regex with `\b`
  - [ ] Email Extraction 2: mailto links regex
  - [ ] Email Extraction 3: aggressive (contact pages only) without `\b`
  - [ ] Email Garbage check for each
  - [ ] Email Dedup: `if not in all_emails`
  - [ ] Phone Extraction: `_extract_phones_from_text()`
  - [ ] Phone Cleaning: `_clean_phone_extension()`
  - [ ] Phone Validation: `_is_valid_phone()`
  - [ ] Phone Length: `len(normalized) >= 7`
  - [ ] Phone Storage: `all_phones[normalized] = ...`
  - [ ] Log source result

### 3.4 PASS 5: Table Extraction
- [ ] Check: `hasattr(result, 'tables') and result.tables`
- [ ] For each table: call `_extract_from_table()`
- [ ] Handle exceptions, don't break main flow

### 3.5 Return from _extract_contacts
- [ ] Return: `(emails_on_page, phones_on_page)` as sets
- [ ] Both sets contain display format strings

---

## Phase 4: Traversal Logic

### 4.1 Traverse Links Method
```python
def _traverse_links(self, result, current_url: str, domain: str, current_depth: int, visited: Set[str], queue: deque) -> int:
```
- [ ] Initialize forced_contact_urls (4 URLs)
- [ ] Initialize links_added counter, forced_urls_added counter

### 4.2 Forced URLs Processing
- [ ] For each forced URL:
  - [ ] Normalize: split # and ?
  - [ ] Check: not visited and not in queue
  - [ ] Add to FRONT: `queue.appendleft((forced_url, current_depth + 1))`
  - [ ] Increment counters

### 4.3 Extracted Links Processing
- [ ] Get internal_links from result.links["internal"]
- [ ] For each link (dict with href):
  - [ ] Get href: `link.get("href")`
  - [ ] Normalize: urljoin + split # and ?
  - [ ] Filter 1: skip if '?' in href
  - [ ] Filter 2: same domain check
  - [ ] Filter 3: not visited check
  - [ ] Filter 4: not in queue check
  - [ ] Filter 5: depth limit check
  - [ ] Filter 6: skip if priority keyword (already forced)
  - [ ] Add to BACK: `queue.append((normalized_url, current_depth + 1))`
  - [ ] Increment counter

### 4.4 Logging
- [ ] Log forced URLs added
- [ ] Log regular URLs added
- [ ] Return: `links_added`

---

## Phase 5: Fetch Page

### 5.1 Fetch Page Method
```python
async def _fetch_page(self, crawler, url: str):
```
- [ ] Create CrawlerRunConfig with:
  - [ ] `wait_until="networkidle"`
  - [ ] `page_timeout=self.timeout * 1000`
  - [ ] `word_count_threshold=5`
  - [ ] `scan_full_page=True`
  - [ ] `remove_overlay_elements=True`
  - [ ] `process_iframes=True`
- [ ] Try-catch: `await crawler.arun(url, config=config)`
- [ ] Check: `result.success`
- [ ] Return: result object or None
- [ ] Log errors with logger.debug()

---

## Phase 6: Fallback Crawler

### 6.1 Fallback Crawl Method
```python
def _fallback_crawl(self, domain_url: str, domain: str, all_emails: Dict, all_phones: Dict, sources: set, status_per_site: Dict) -> int:
```
- [ ] Initialize: page_count = 0
- [ ] Initialize: queue = deque([(domain_url, 0)])
- [ ] Initialize: visited = set()
- [ ] Initialize: forced_urls list (4 URLs)
- [ ] Initialize: logging separator

### 6.2 Fallback BFS Loop
- [ ] While queue and page_count < 5:
  - [ ] Popleft from queue
  - [ ] Check visited/depth
  - [ ] Add to visited
  - [ ] Fetch with `_fallback_fetch()`
  - [ ] On success: increment page_count, add to sources
  - [ ] Extract contacts with `_extract_contacts_from_html()`
  - [ ] Extract links with `_extract_links_from_html()`
  - [ ] Add forced URLs first (with priority)
  - [ ] Add extracted links (lower priority)
  - [ ] Log results

### 6.3 Return
- [ ] Return: `page_count` (int)

### 6.4 Fallback Extraction
```python
def _extract_contacts_from_html(self, html: str, source_url: str, all_emails: Dict, all_phones: Dict) -> Tuple[set, set]:
```
- [ ] Same as main _extract_contacts() but:
  - [ ] No result object (use html string directly)
  - [ ] No Pass 5 (tables)
  - [ ] All sources from html only

---

## Phase 7: Main Extract Method

### 7.1 Extract Method
```python
async def extract(self, domain_url: str) -> Dict:
```

### 7.2 Initialization
- [ ] Normalize URL: add https:// if missing
- [ ] Extract domain: `urlparse(domain_url).netloc`
- [ ] Log separator + params
- [ ] Initialize: all_emails, all_phones, sources, status_per_site, page_count
- [ ] Initialize: BFS queue, visited set, crawl4ai_failed flag

### 7.3 Main BFS Loop
```python
async with AsyncWebCrawler() as crawler:
    while queue and page_count < self.max_pages:
```
- [ ] Popleft from queue
- [ ] Check visited/depth (continue if match)
- [ ] Add to visited
- [ ] Call LAYER 1: `_fetch_page(crawler, current_url)`
- [ ] On None: set crawl4ai_failed, continue
- [ ] Increment page_count, add to sources
- [ ] Call LAYER 2: `_extract_contacts(result, current_url, all_emails, all_phones)`
- [ ] Log extraction results
- [ ] Check: result.tables (if exists)
- [ ] Call LAYER 3: `_traverse_links(...)`
- [ ] Log traversal results

### 7.4 Fallback Check
- [ ] If crawl4ai_failed and len(sources) == 0:
  - [ ] Call `_fallback_crawl(...)`
  - [ ] Add fallback_page_count to page_count

### 7.5 Post-Processing
- [ ] Format phones: convert dict to list of dicts with source_page
- [ ] Format emails: convert dict to list of dicts with source_page
- [ ] Sort: emails alphabetically, phones by normalized key
- [ ] Slice: emails[:10], phones[:10], sources[:10]
- [ ] Build result dict

### 7.6 Debug Logging
- [ ] Log all emails dict (first 20)
- [ ] Log phones_list (first 20)
- [ ] Log slicing decision
- [ ] Log final counts
- [ ] Log validation summary

### 7.7 Return
- [ ] Return: result dict with emails, phones, sources, status_per_site

---

## Phase 8: FastAPI Integration

### 8.1 Models
- [ ] `ExtractRequest` with `urls: List[str]`
- [ ] `ContactEmail` with `email: str, source_page: str`
- [ ] `ContactPhone` with `phone: str, source_page: str`
- [ ] `ContactResult` with website, emails, phones, sources, status_per_site
- [ ] `ExtractResponse` with results, total

### 8.2 FastAPI Setup
- [ ] Create FastAPI app
- [ ] Add CORS middleware (allow all origins)
- [ ] Set logging level to INFO

### 8.3 API Endpoint
```python
@app.post("/api/extract", response_model=ExtractResponse)
async def extract_contacts(request: ExtractRequest):
```
- [ ] Validate: urls not empty
- [ ] Strip and filter URLs
- [ ] Create Crawl4AIClient instance
- [ ] For each URL: gather tasks
- [ ] Execute all tasks: `asyncio.gather(*tasks, return_exceptions=True)`
- [ ] Process results (handle exceptions)
- [ ] Normalize display URL
- [ ] Collect sources from emails and phones
- [ ] Build ContactResult objects
- [ ] Return ExtractResponse

### 8.4 Health Check
```python
@app.get("/api/health")
async def health_check():
```
- [ ] Return: `{"status": "ok"}`

### 8.5 Main Entry
```python
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

---

## Phase 9: Testing

### 9.1 Unit Tests
- [ ] Test `_normalize_html_entities()`
- [ ] Test `_clean_phone_extension()`
- [ ] Test `_is_valid_phone()`
  - [ ] Test valid: "+7(831)262-16-42"
  - [ ] Test valid: "8(831)262-16-42"
  - [ ] Test invalid: "123" (too short)
  - [ ] Test invalid: "12345678901234" (too long)
- [ ] Test `_normalize_phone()`
- [ ] Test `_extract_phones_from_text()`
- [ ] Test `_extract_links_from_html()`

### 9.2 Integration Tests
- [ ] Test single URL extraction
- [ ] Test BFS traversal (3+ pages)
- [ ] Test email extraction (with garbage filter)
- [ ] Test phone extraction (with validation)
- [ ] Test fallback crawler activation
- [ ] Test result formatting

### 9.3 API Tests
- [ ] POST /api/extract with valid URLs
- [ ] POST /api/extract with invalid URLs
- [ ] POST /api/extract with empty list
- [ ] GET /api/health

### 9.4 Edge Cases
- [ ] Domain with no contacts
- [ ] Domain with special characters in email
- [ ] Domain with extensions in phone
- [ ] Domain with HTML entities in separators
- [ ] Domain with iframe content

---

## Phase 10: Logging & Debugging

### 10.1 Logging Setup
```python
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
```
- [ ] Set INFO level (production)
- [ ] Use logger.info() for major events
- [ ] Use logger.debug() for details
- [ ] Use logger.error() for errors

### 10.2 Debug Points
- [ ] Log BFS start/end
- [ ] Log each page processed
- [ ] Log emails found
- [ ] Log phones found (with validation status)
- [ ] Log links added
- [ ] Log dedup decisions
- [ ] Log final result counts

### 10.3 Common Issues to Monitor
- [ ] Missing emails on contact pages
- [ ] HTML entity separators (`&nbsp;` in phone)
- [ ] Phone extensions not removed
- [ ] Query parameters creating duplicates
- [ ] Crawl4AI timeouts
- [ ] Fallback crawler activation

---

## Phase 11: Performance Optimization

### 11.1 Caching
- [ ] Consider URL dedup at queue level (already done)
- [ ] Consider email dedup for visited pages (already done)
- [ ] Consider phone dedup (currently disabled - verify intentional)

### 11.2 Limits
- [ ] Verify max_pages=10 is reasonable
- [ ] Verify max_depth=2 is reasonable
- [ ] Verify max_links_per_page=30 is reasonable
- [ ] Verify email/phone slice=10 is reasonable

### 11.3 Monitoring
- [ ] Add timing per phase (fetch, extraction, traversal)
- [ ] Monitor Crawl4AI vs fallback ratio
- [ ] Monitor average contacts per domain
- [ ] Monitor timeout rates

---

## Phase 12: Deployment

### 12.1 Requirements
- [ ] Create `requirements.txt`:
  ```
  fastapi==0.104.1
  uvicorn==0.24.0
  crawl4ai==0.8.0
  pydantic==2.5.0
  requests==2.31.0
  ```

### 12.2 Docker (Optional)
- [ ] Create `Dockerfile`
- [ ] Create `.dockerignore`

### 12.3 Startup
- [ ] Run: `python -m uvicorn main:app --reload`
- [ ] Verify: http://localhost:8000/api/health
- [ ] Test: POST http://localhost:8000/api/extract

### 12.4 Documentation
- [ ] FastAPI auto-docs: http://localhost:8000/docs
- [ ] ReDoc docs: http://localhost:8000/redoc

---

## Verification Checklist

### Feature Completeness
- [ ] BFS traversal working (visit 3+ pages)
- [ ] Email extraction with garbage filter working
- [ ] Phone extraction with validation working
- [ ] Tel links prioritized correctly
- [ ] Forced URLs added to queue
- [ ] Link prioritization working
- [ ] Fallback crawler activates on error
- [ ] Results formatted correctly
- [ ] Results sliced to max 10 each

### Code Quality
- [ ] All regex patterns exactly as specified
- [ ] All HTML entities normalized
- [ ] All filters applied correctly
- [ ] All validations implemented
- [ ] Exception handling at each layer
- [ ] Logging comprehensive
- [ ] No hardcoded values
- [ ] Type hints correct

### Behavior Verification
- [ ] Email dedup enabled
- [ ] Phone dedup disabled (intentionally)
- [ ] Query string filtering works
- [ ] Domain filtering works
- [ ] Depth limiting works
- [ ] Page limit works
- [ ] Priority order correct

---

## Success Criteria

- [ ] Extract 3+ emails from example.com
- [ ] Extract 1+ phones from example.com
- [ ] Crawl 5-10 pages per domain
- [ ] Process domain in < 60 seconds
- [ ] Handle errors gracefully
- [ ] Fallback crawler working
- [ ] API responding correctly
- [ ] Results formatted as specified
- [ ] All code matches specification exactly

---

**Status:** Ready for Implementation
**Version:** v3.0
**Date:** 2026-03-18
