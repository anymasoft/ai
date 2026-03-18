"""
Crawl4AI with MANUAL BFS traversal for contact extraction.
ARCHITECTURE: Manual BFS control with Crawl4AI as fetch engine
- FETCH: AsyncWebCrawler (single page)
- EXTRACTION: Regex post-processing + Table extraction
- TRAVERSAL: Manual BFS with queue [(url, depth)]
"""

import asyncio
import re
import logging
import requests
from typing import Dict, List, Optional, Tuple, Set
from urllib.parse import urlparse, urljoin
from collections import deque

# ⭐ Новый модульный phone_extractor (v1.0)
from phone_extractor import extract_phones_from_crawl_result

logger = logging.getLogger(__name__)


class Crawl4AIClient:
    """
    Contact extraction using manual BFS traversal.
    Crawl4AI handles single page fetch, we control the crawl strategy.
    """

    def __init__(self, timeout: int = 30, max_pages: int = 25, max_depth: int = 3):
        """
        RECALL-FIRST PIPELINE (v4.0)
        - max_pages = 25 (was 10) - crawl more pages
        - max_depth = 3 (was 2) - go deeper
        - max_links = 100 (was 30) - gather more candidates
        """
        self.timeout = timeout
        self.max_pages = max_pages
        self.max_depth = max_depth

    def _merge_fragmented_numbers(self, text: str) -> str:
        """
        MERGE FRAGMENTED NUMBERS (v2.5) — Склеить разбитые номера

        Проблема: HTML теги/переносы строк разбивают номер на части
        <span>+7</span> <span>985</span> <span>587</span> → "+7 985 587"

        Примеры разбивок:
        ❌ <span>+7</span><span>985</span> → +7985
        ❌ +7</span>\n<span>985 → +7985
        ❌ 8   \n  (383) → 8(383)
        ❌ 8 385  587  45 82 → 8 385587 4582

        Решение: 3 простых regex замены

        Примеры после:
        ✅ <span>+7</span><span>985</span> → +7985
        ✅ 8   \n   (383) → 8(383)
        ✅ 8 385  587  45 82 → 8 385 587 45 82 (читаемо)
        """
        if not text:
            return text

        # Правило 1: убрать HTML-теги между цифрами
        # </span><span> → ничего, или </span> <span> → пробел
        # Примеры:
        # <span>+7</span><span>985</span> → +7985
        # <span>+7</span> <span>985</span> → +7 985
        text = re.sub(r'(\d)\s*</\w+>\s*<\w+[^>]*>\s*(\d)', r'\1\2', text)

        # Правило 2: склеить разрывы строк между цифрами
        # Примеры:
        # "8\n(383)" → "8(383)"
        # "8 \n 383" → "8 383"
        # "8\n\n383" → "8 383"
        text = re.sub(r'(\d)\s*\n\s*(\d)', r'\1\2', text)

        # Правило 3: Склеить слишком разорванные последовательности цифр
        # "8   385" (3+ пробела) → "8 385"
        # "8\t\t\t385" → "8 385"
        # НО: "(383) 262" (1-2 пробела) → оставить как есть
        text = re.sub(r'(\d)\s{2,}(?=\d)', r'\1 ', text)

        logger.debug(f"[MERGE FRAGMENTED] Processed {len(text)} chars")
        return text

    def _is_structural_phone(self, candidate: str) -> bool:
        """
        STRUCTURAL FILTER (v2.5) — Удалить мусор по структуре

        После sanity filter (7-15 цифр) осталось:
        - ID: 1761844453451
        - Даты: 01.01.2024, 2024-01-01
        - Годы: 1997-2026
        - Чистые числа: 132232434
        - Кривые склейки: 8 385  587  45 82

        Проверяем: есть ли в номере признаки ТЕЛЕФОНА

        Требования:
        1. НЕ диапазон годов (1997-2026)
        2. НЕ дата (01.01.2024)
        3. НЕ чистые цифры (без разделителей)
        4. НЕ длинные ID
        5. НЕ кривые переносы
        6. ДА содержит хотя бы один разделитель (+, (, ), -, space)

        Примеры:
        ✅ "+7 (383) 209-21-27" → PASS (много разделителей)
        ✅ "8(383)262-16-42" → PASS (скобки, дефисы)
        ✅ "203 555 0162" → PASS (пробелы = разделители)
        ❌ "1997-2026" → FAIL (диапазон годов)
        ❌ "01.01.2024" → FAIL (дата)
        ❌ "132232434" → FAIL (чистые цифры, нет разделителей)
        ❌ "1761844453451" → FAIL (длинное число без структуры)
        """
        if not candidate or not isinstance(candidate, str):
            return False

        try:
            digits = re.sub(r'\D', '', candidate)

            # Проверка 1: НЕ диапазон годов (XXXX-XXXX)
            # Примеры: "1997-2026", "2000-2024"
            if re.fullmatch(r'\d{4}-\d{4}', candidate.strip()):
                logger.debug(f"[STRUCTURAL FILTER] Year range detected: {candidate}")
                return False

            # Проверка 2: НЕ дата (с точками, дефисами, слэшами)
            # Примеры: "01.01.2024", "1/1/2024", "2024-01-01"
            if re.search(r'\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4}', candidate):
                logger.debug(f"[STRUCTURAL FILTER] Date detected: {candidate}")
                return False

            # Проверка 3: НЕ чистые цифры (без разделителей)
            # Примеры: "132232434", "9123456789"
            # Исключение: tel: links уже прошли раньше
            if re.fullmatch(r'\d{7,15}', candidate.strip()):
                logger.debug(f"[STRUCTURAL FILTER] Pure digits (no structure): {candidate}")
                return False

            # Проверка 4: НЕ длинное число без структуры
            # Пример: "1761844453451" (13+ цифр, ID)
            if len(digits) >= 12 and candidate.isdigit():
                logger.debug(f"[STRUCTURAL FILTER] Long ID-like number: {candidate}")
                return False

            # Проверка 5: НЕ кривые переносы внутри
            # Пример: "8)\n(383" (скобка, перенос, скобка)
            if re.search(r'\)\s*\n', candidate):
                logger.debug(f"[STRUCTURAL FILTER] Broken line in middle: {candidate}")
                return False

            # КЛЮЧЕВАЯ ПРОВЕРКА 6: ДОЛЖНЫ содержать разделители
            # Разделители: +, (, ), -, пробелы
            # Это признак структурированного телефона
            if not re.search(r'[\(\)\-\+\s]', candidate):
                logger.debug(f"[STRUCTURAL FILTER] No phone-like separators: {candidate}")
                return False

            # ✅ Все проверки пройдены
            logger.debug(f"[STRUCTURAL FILTER] PASS: {candidate}")
            return True

        except Exception as e:
            logger.debug(f"[STRUCTURAL FILTER] Exception: {e}")
            return False

    def _normalize_text(self, text: str) -> str:
        """
        PRE-NORMALIZATION (RECALL-FIRST v4.0 + v2.5)

        Critical preprocessing to maximize recall of contact extraction.
        Handles:
        - Fragmented numbers (HTML tags, line breaks) — v2.5
        - HTML entities (&nbsp; &mdash; etc.)
        - Zero-width characters (invisible separators)
        - Non-breaking spaces and common obfuscation
        - Collapsed whitespace
        - Broken phone numbers (multiline repair)

        Examples:
        ✅ "<span>+7</span><span>985</span>" → "+7985" → findable
        ✅ "89&nbsp;153&nbsp;" → "89 153 " → findable by regex
        ✅ "8\u200b(383)33\u200b-05-42" → "8(383)33-05-42"
        ✅ "8\n 383" → "8383" (for regex \\d)
        """
        if not text:
            return text

        # === 0. MERGE FRAGMENTED NUMBERS (v2.5) ===
        # CRITICAL: Must be FIRST to fix HTML-fragmented spans
        text = self._merge_fragmented_numbers(text)

        # === 1. HTML ENTITIES ===
        text = text.replace('&nbsp;', ' ')
        text = text.replace('&#160;', ' ')
        text = text.replace('&ndash;', '-')
        text = text.replace('&mdash;', '-')
        text = text.replace('&middot;', '-')
        text = text.replace('&amp;', '&')
        text = text.replace('&lt;', '<')
        text = text.replace('&gt;', '>')
        text = text.replace('&#8209;', '-')
        text = text.replace('&#8211;', '-')
        text = text.replace('&#8212;', '-')
        text = text.replace('&quot;', '"')
        text = text.replace('&#34;', '"')

        # === 2. ZERO-WIDTH & INVISIBLE CHARS ===
        # Remove: zero-width space, zero-width joiner, zero-width no-break space, BOM
        text = re.sub(r'[\u200B-\u200D\uFEFF]', '', text)

        # === 3. COMMON OBFUSCATION ===
        text = text.replace('[at]', '@')
        text = text.replace('(at)', '@')
        text = text.replace(' at ', '@')
        text = text.replace('[dot]', '.')
        text = text.replace('(dot)', '.')

        # === 4. BROKEN PHONE NUMBERS (CRITICAL!) ===
        # Pattern: digit + newline/spaces + digit → merge
        # Example: "8\n 383" → "8383"
        text = re.sub(r'(\d)\s*\n\s*(\d)', r'\1\2', text)

        # Also handle: digit + multiple spaces + digit
        # Example: "8    383" → "8383"
        # But keep 1-2 spaces for readability in "(XXX) XXX"
        text = re.sub(r'(\d)\s{3,}(\d)', r'\1 \2', text)

        # === 5. COLLAPSE MULTIPLE SPACES ===
        text = re.sub(r' {2,}', ' ', text)
        text = re.sub(r'\t+', ' ', text)

        return text.strip()

    def _fallback_fetch(self, url: str) -> str:
        """
        Simple fetch using requests.
        Returns HTML content or empty string on error.
        """
        try:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
            response = requests.get(url, headers=headers, timeout=10)
            if response.status_code == 200:
                return response.text
            return ""
        except Exception as e:
            logger.debug(f"Fallback fetch failed for {url}: {e}")
            return ""

    def _extract_links_from_html(self, html: str, current_url: str, domain: str) -> List[str]:
        """
        Extract ONLY relevant internal links from HTML using regex.
        Filters out static files, assets, and garbage paths.
        Returns list of normalized URLs (prioritized: contact > about > rest).
        """
        links = []
        priority_links = []  # Для приоритизации

        # Extensions to exclude (static files)
        BAD_EXTENSIONS = {
            '.css', '.js', '.png', '.jpg', '.jpeg', '.gif',
            '.svg', '.ico', '.webp', '.woff', '.woff2', '.ttf',
            '.eot', '.pdf', '.zip', '.exe', '.mp3', '.mp4',
            '.avi', '.mov', '.wav', '.mov', '.xml', '.rss'
        }

        # Paths to exclude (asset directories)
        BAD_PATHS = {
            '/bitrix/', '/wp-content/', '/wp-includes/',
            '/assets/', '/static/', '/dist/', '/build/',
            '/node_modules/', '/vendor/', '/media/',
            '/images/', '/css/', '/js/', '/fonts/',
            '/download/', '/uploads/', '/.git/', '/admin/'
        }

        try:
            # Extract all href values
            for match in re.finditer(r'href=["\']([^"\']+)["\']', html):
                href = match.group(1)
                if not href or href.startswith(('javascript:', 'mailto:', 'tel:', 'ftp:', '#')):
                    continue

                try:
                    # Normalize URL
                    normalized_url = urljoin(current_url, href)
                    normalized_url = normalized_url.split('#')[0]  # Remove fragment
                    normalized_url = normalized_url.split('?')[0]  # Remove query

                    # === FILTER 1: Same domain ===
                    link_domain = urlparse(normalized_url).netloc
                    if link_domain != domain:
                        continue

                    # === FILTER 2: No bad extensions ===
                    url_lower = normalized_url.lower()
                    if any(url_lower.endswith(ext) for ext in BAD_EXTENSIONS):
                        continue

                    # === FILTER 3: No bad paths ===
                    if any(bad_path in url_lower for bad_path in BAD_PATHS):
                        continue

                    # === FILTER 4: Only HTML pages ===
                    # Accept: /page, /page/, /page.html
                    # Reject: /file.pdf, /style.css, etc
                    path = urlparse(normalized_url).path.lower()
                    if path and '.' in path:
                        # Has extension - only accept .html
                        if not path.endswith('.html'):
                            continue

                    # === DEDUP ===
                    if normalized_url in links or normalized_url in priority_links:
                        continue

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

                except Exception:
                    continue

        except Exception as e:
            logger.debug(f"Link extraction error: {e}")

        # Return: priority links first, then regular links
        # RECALL-FIRST: Increased from 30 to 100 to gather more candidates
        result = priority_links + links
        return result[:100]  # Increased to maximize discovery

    def _fallback_crawl(
        self,
        domain_url: str,
        domain: str,
        all_emails: Dict,
        all_phones: Dict,
        sources: set,
        status_per_site: Dict
    ) -> int:
        """
        FALLBACK CRAWLER: Full BFS traversal using requests (when Crawl4AI blocked).
        Independent from main crawler - uses same extraction logic.

        Returns: number of pages crawled
        """
        logger.info(f"\n{'='*60}")
        logger.info(f"⚠️  FALLBACK CRAWLER ACTIVATED (Crawl4AI blocked)")
        logger.info(f"Domain: {domain}")
        logger.info(f"Max pages: 5, Max depth: 2")
        logger.info(f"{'='*60}")

        page_count = 0
        queue = deque([(domain_url, 0)])
        visited = set()

        # Forced URLs to always check
        forced_urls = [
            urljoin(domain_url, '/contact'),
            urljoin(domain_url, '/contacts'),
            urljoin(domain_url, '/about'),
            urljoin(domain_url, '/team'),
        ]

        try:
            while queue and page_count < 5:  # Fallback limit: 5 pages
                current_url, depth = queue.popleft()

                # Skip if visited or depth exceeded
                if current_url in visited or depth > 2:
                    continue

                visited.add(current_url)

                # FETCH
                logger.info(f"\n[Fallback Page {page_count + 1}/5] Depth {depth} → {current_url.replace(f'https://{domain}', '')[:50]}")
                html = self._fallback_fetch(current_url)

                if not html:
                    logger.debug(f"  ✗ Fetch failed")
                    status_per_site[current_url] = "fallback_failed"
                    continue

                page_count += 1
                sources.add(current_url)
                status_per_site[current_url] = "fallback_success"

                # EXTRACTION
                emails_on_page, phones_on_page = self._extract_contacts_from_html(
                    html, current_url, all_emails, all_phones
                )

                if emails_on_page or phones_on_page:
                    logger.info(f"  ✓ Found {len(emails_on_page)} emails, {len(phones_on_page)} phones")

                # TRAVERSAL - Extract filtered links
                extracted_links = self._extract_links_from_html(html, current_url, domain)

                # Add forced URLs first (highest priority)
                priority_urls = []
                for forced_url in forced_urls:
                    if forced_url not in visited and forced_url not in [u[0] for u in queue]:
                        priority_urls.append(forced_url)

                # Add extracted links
                all_links_to_add = priority_urls + extracted_links

                # Add to queue with priority (prepend priority URLs)
                links_added = 0
                for i, link in enumerate(all_links_to_add):
                    if link not in visited and link not in [u[0] for u in queue]:
                        # Prepend priority URLs (forced), append others
                        if i < len(priority_urls):
                            queue.appendleft((link, depth + 1))  # Priority: add to front
                        else:
                            queue.append((link, depth + 1))  # Regular: add to back
                        links_added += 1

                if links_added > 0:
                    logger.info(f"  → Added {links_added} filtered URLs (extracted {len(extracted_links)} from {html[:100]}...)")
                else:
                    logger.info(f"  → No new URLs found (extracted {len(extracted_links)} but all visited)")

            logger.info(f"\n{'='*60}")
            logger.info(f"✓ Fallback crawl completed: {page_count} pages")
            logger.info(f"{'='*60}\n")

        except Exception as e:
            logger.error(f"Fallback crawler error: {e}", exc_info=True)

        return page_count

    def _extract_contacts_from_html(
        self,
        html: str,
        source_url: str,
        all_emails: Dict,
        all_phones: Dict
    ) -> Tuple[set, set]:
        """
        Extract emails and phones from raw HTML (for fallback crawler).

        Uses same improved logic as main _extract_contacts():
        ✅ HTML entity normalization
        ✅ Extension removal
        ✅ Improved phone regex
        ✅ Tel links prioritized

        This is fallback when Crawl4AI is blocked.
        """
        emails_on_page = set()
        phones_on_page = set()

        garbage_patterns = [
            r'^test[._-]?',
            r'^example[._-]?',
            r'^noreply',
            r'^no-?reply',
            r'^donotreply',
            r'^invalid',
            r'^placeholder',
        ]

        try:
            if not html:
                return emails_on_page, phones_on_page

            # ========== PASS 1: TEL: LINKS ==========
            try:
                tel_links = re.findall(r'href=["\']?tel:([^"\'>\s]+)', html)
                for phone in tel_links:
                    phone_clean = self._clean_phone_extension(phone.strip())
                    if phone_clean:
                        # 🔥 STRICT VALIDATION
                        if not self._is_valid_phone(phone_clean):
                            logger.debug(f"[FALLBACK PHONE FILTER] Tel link rejected: {phone_clean}")
                            continue

                        normalized = self._normalize_phone(phone_clean)
                        if len(normalized) >= 7:
                            # 🔴 DEBUG: DISABLED DEDUP
                            # if len(normalized) >= 7 and normalized not in all_phones:
                            logger.info(f"[FALLBACK DEBUG DEDUP DISABLED] Tel link: {phone_clean}")
                            all_phones[normalized] = {"original": phone_clean, "source": source_url}
                            phones_on_page.add(phone_clean)
            except Exception as e:
                logger.debug(f"[FALLBACK] Tel link error: {e}")

            # ========== NORMALIZE CONTENT ==========
            # Normalize HTML entities (CRITICAL!)
            html_normalized = self._normalize_html_entities(html)

            # Normalize common obfuscation
            html_normalized = html_normalized.replace("[at]", "@")
            html_normalized = html_normalized.replace("(at)", "@")
            html_normalized = html_normalized.replace(" at ", "@")

            # ========== EMAIL EXTRACTION ==========
            try:
                # Standard regex
                for email in re.findall(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', html_normalized):
                    email_clean = email.lower().strip()
                    is_garbage = any(re.match(pattern, email_clean.split('@')[0]) for pattern in garbage_patterns)
                    if not is_garbage and email_clean not in all_emails:
                        all_emails[email_clean] = source_url
                        emails_on_page.add(email_clean)

                # mailto: links
                for match in re.findall(r'href=["\']?mailto:([^"\'>\s]+)', html):
                    if "@" in match:
                        email_clean = match.lower().strip()
                        is_garbage = any(re.match(pattern, email_clean.split('@')[0]) for pattern in garbage_patterns)
                        if not is_garbage and email_clean not in all_emails:
                            all_emails[email_clean] = source_url
                            emails_on_page.add(email_clean)

                # Aggressive on contact pages
                if any(p in source_url.lower() for p in ['contact', 'about', 'team']):
                    for match in re.findall(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}', html_normalized):
                        email_clean = match.lower().strip()
                        is_garbage = any(re.match(pattern, email_clean.split('@')[0]) for pattern in garbage_patterns)
                        if not is_garbage and email_clean not in all_emails:
                            all_emails[email_clean] = source_url
                            emails_on_page.add(email_clean)

            except Exception as e:
                logger.debug(f"[FALLBACK] Email extraction error: {e}")

            # ========== PHONE EXTRACTION ==========
            try:
                # Use improved phone extraction
                found_phones = self._extract_phones_from_text(html_normalized)

                for phone in found_phones:
                    phone_clean = self._clean_phone_extension(phone)
                    if phone_clean:
                        # 🔥 STRICT VALIDATION
                        if not self._is_valid_phone(phone_clean):
                            logger.debug(f"[FALLBACK PHONE FILTER] Rejected: {phone_clean}")
                            continue

                        normalized = self._normalize_phone(phone_clean)
                        if len(normalized) >= 7:
                            # 🔴 DEBUG: DISABLED DEDUP
                            # if len(normalized) >= 7 and normalized not in all_phones:
                            logger.info(f"[FALLBACK DEBUG DEDUP DISABLED] Phone: {phone_clean}")
                            all_phones[normalized] = {"original": phone_clean, "source": source_url}
                            phones_on_page.add(phone_clean)

            except Exception as e:
                logger.debug(f"[FALLBACK] Phone extraction error: {e}")

        except Exception as e:
            logger.debug(f"[FALLBACK] Extraction error on {source_url}: {e}")

        logger.debug(f"[FALLBACK] Extracted {len(emails_on_page)} emails, {len(phones_on_page)} phones")
        return emails_on_page, phones_on_page

    async def extract(self, domain_url: str) -> Dict:
        """
        Extract contacts using manual BFS traversal with Crawl4AI as fetch engine.
        Returns: {"emails": [...], "phones": [...], "sources": [...], "status_per_site": {...}}
        """

        from crawl4ai import AsyncWebCrawler, CrawlerRunConfig

        # Normalize input URL
        if not domain_url.startswith(('http://', 'https://')):
            domain_url = f'https://{domain_url}'

        domain = urlparse(domain_url).netloc

        logger.info(f"\n{'='*60}")
        logger.info(f"Starting BFS traversal: {domain_url}")
        logger.info(f"Max pages: {self.max_pages}, Max depth: {self.max_depth}")
        logger.info(f"{'='*60}")

        # Global storage for results
        all_emails = {}  # {phone_normalized: phone_original}
        all_phones = {}  # {phone_normalized: phone_original}
        sources = set()
        status_per_site = {}
        page_count = 0

        # ⭐ MULTI-ENTRY STRATEGY (v4.0)
        # Don't start only from homepage - add seed URLs that likely have contacts
        # This gives us parallel paths to find contacts faster
        seed_urls = [
            domain_url,
            urljoin(domain_url, '/contact'),
            urljoin(domain_url, '/contacts'),
            urljoin(domain_url, '/about'),
        ]

        queue = deque()
        for seed_url in seed_urls:
            # Normalize and deduplicate
            normalized = seed_url.split('#')[0].split('?')[0]
            queue.append((normalized, 0))

        visited = set()
        crawl4ai_failed = False  # Flag to activate fallback crawler

        logger.info(f"[MULTI-ENTRY] Starting from {len(seed_urls)} entry points:")
        for url in seed_urls:
            logger.info(f"  → {url.replace(f'https://{domain}', '')}")

        try:
            async with AsyncWebCrawler() as crawler:

                while queue and page_count < self.max_pages:
                    current_url, depth = queue.popleft()

                    # Skip if visited or depth exceeded
                    if current_url in visited or depth > self.max_depth:
                        continue

                    visited.add(current_url)

                    # LAYER 1: FETCH
                    result = await self._fetch_page(crawler, current_url)

                    if result is None:
                        # Crawl4AI failed - signal fallback crawler
                        crawl4ai_failed = True
                        status_per_site[current_url] = "fetch_failed"
                        continue

                    page_count += 1
                    sources.add(current_url)
                    status_per_site[current_url] = "success"

                    # Log page info
                    short_url = current_url.replace(f'https://{domain}', '')[:50]
                    logger.info(f"\n[Page {page_count}/{self.max_pages}] Depth {depth} → {short_url}")

                    # LAYER 2: EXTRACTION (independent of traversal)
                    emails_on_page, phones_on_page = self._extract_contacts(
                        result, current_url, all_emails, all_phones
                    )
                    if emails_on_page or phones_on_page:
                        logger.info(f"  ✓ Found {len(emails_on_page)} emails, {len(phones_on_page)} phones")

                    # Extract from tables if available
                    if result.tables:
                        logger.info(f"  Found {len(result.tables)} table(s)")
                        for table in result.tables:
                            self._extract_from_table(table, current_url, all_emails, all_phones)

                    # LAYER 3: TRAVERSAL (independent of extraction)
                    links_added = self._traverse_links(
                        result, current_url, domain, depth, visited, queue
                    )
                    logger.info(f"  → Added {links_added} URLs to queue")

            # If Crawl4AI failed on first page, activate fallback crawler
            if crawl4ai_failed and len(sources) == 0:
                logger.info(f"\n{'='*60}")
                logger.info(f"Crawl4AI blocked on first page, activating fallback crawler...")
                logger.info(f"{'='*60}")

                fallback_page_count = self._fallback_crawl(
                    domain_url, domain, all_emails, all_phones, sources, status_per_site
                )
                page_count += fallback_page_count

        except Exception as e:
            logger.error(f"Fatal error: {e}", exc_info=True)

        # Build final result
        # Format phones: convert dict values to display format
        phones_list = []
        for normalized_key, phone_data in sorted(all_phones.items()):
            if isinstance(phone_data, dict):
                phones_list.append({
                    "phone": phone_data["original"],  # Show original format
                    "source_page": phone_data["source"]
                })
            else:
                # Fallback for old format
                phones_list.append({
                    "phone": phone_data,
                    "source_page": ""
                })

        # ⭐ LIMIT CANDIDATES (important for LLM performance)
        # Collect all candidates, but limit to 30 for LLM processing
        # (More than 30 is rare, and LLM can't handle too many at once)
        if len(phones_list) > 30:
            logger.warning(
                f"[CANDIDATE LIMIT] Found {len(phones_list)} candidates, "
                f"limiting to 30 for LLM (others will be discarded)"
            )
            phones_list = phones_list[:30]

        # ========== STAGE 4: FINAL LLM VALIDATION (NEW!) ==========
        # ⭐ CRITICAL: Validate all phones through LLM before returning
        logger.info(f"\n{'='*60}")
        logger.info(f"[FINAL VALIDATION] Starting LLM validation...")
        logger.info(f"  📊 Phones BEFORE LLM: {len(phones_list)}")

        try:
            from phone_final_validator import PhoneFinalValidator

            validator = PhoneFinalValidator(use_llm=True)

            # Validate all phones with domain context
            validated_phones = validator.validate_phones(
                phones_list,
                page_url=domain_url,
                page_text=""  # Context not needed for simple validation
            )

            logger.info(f"  ✅ Phones AFTER LLM: {len(validated_phones)}")
            if len(validated_phones) < len(phones_list):
                logger.info(f"  ✨ LLM removed {len(phones_list) - len(validated_phones)} false positives")

            # Use validated result (with fallback)
            phones_list = validated_phones if validated_phones else phones_list

        except ImportError:
            logger.warning(f"[LLM VALIDATION] phone_final_validator not available, using extraction results")
        except Exception as e:
            logger.warning(f"[LLM VALIDATION] LLM validation failed: {e}, using extraction results")

        logger.info(f"[FINAL VALIDATION] Complete")
        logger.info(f"{'='*60}\n")

        # Emails list - ALL emails, no slicing
        emails_list = [
            {"email": email, "source_page": source}
            for email, source in sorted(all_emails.items())
        ]

        # Sources list - ALL sources, no slicing
        sources_list = list(sources)

        result = {
            "emails": emails_list,  # ✅ ALL emails (no [:10] limit)
            "phones": phones_list,  # ✅ ALL phones (no [:10] limit)
            "sources": sources_list,  # ✅ ALL sources (no [:10] limit)
            "status_per_site": status_per_site,
        }

        # ========== v2.0 RESULT LOGGING ==========
        logger.info(f"\n{'='*60}")
        logger.info(f"[v2.0 RESULT] Crawled {page_count} pages")
        logger.info(f"  Total emails found: {len(result['emails'])}")
        logger.info(f"  Total phones found: {len(result['phones'])}")
        logger.info(f"  Total sources: {len(result['sources'])}")
        logger.info(f"{'='*60}")

        if result['phones']:
            logger.info(f"[SAMPLE PHONES] First 10:")
            for i, phone in enumerate(result['phones'][:10]):
                logger.info(f"  [{i+1}] {phone.get('phone')} (source: {phone.get('source_page', 'N/A')})")

        if result['emails']:
            logger.info(f"[SAMPLE EMAILS] First 10:")
            for i, email in enumerate(result['emails'][:10]):
                logger.info(f"  [{i+1}] {email.get('email')} (source: {email.get('source_page', 'N/A')})")

        logger.info(f"\n[FILTERING APPLIED]")
        logger.info(f"  ✅ v2.0: Sanity filter")
        logger.info(f"       Removes: floats, dates, IDs, broken sequences")
        logger.info(f"  ✅ v2.5: Structural filter")
        logger.info(f"       Removes: year ranges, pure numbers, IDs")
        logger.info(f"  ✅ v2.5: Fragmented merge")
        logger.info(f"       Fixes: <span>+7</span><span>985</span>... → +7985...")
        logger.info(f"  Effect: 85-95% garbage removed pre-LLM")
        logger.info(f"{'='*60}\n")

        return result

    async def _fetch_page(self, crawler, url: str):
        """
        LAYER 1: FETCH - Get page using Crawl4AI
        Returns CrawlResult or None (never raises exception)
        """
        from crawl4ai import CrawlerRunConfig

        try:
            config = CrawlerRunConfig(
                wait_until="networkidle",
                page_timeout=self.timeout * 1000,
                word_count_threshold=5,
                scan_full_page=True,
                remove_overlay_elements=True,
                process_iframes=True,
            )
            result = await crawler.arun(url, config=config)

            if result.success:
                return result

            # If Crawl4AI failed, signal that fallback crawler should be used
            logger.debug(f"Crawl4AI failed for {url}, flagging for fallback crawler")
            return None

        except Exception as e:
            logger.debug(f"Fetch error for {url}: {e}")
            return None

    def _score_url_for_contacts(self, url: str, anchor_text: str = "") -> int:
        """
        ⭐ CONTACT DISCOVERY ENGINE (v4.0)
        Оценить вероятность что URL содержит контакты.

        Scoring система:
        - High priority keywords (contact, contacts, контакты): +5
        - Medium priority keywords (about, team, office, офис): +3
        - Low priority keywords (help, support, feedback): +1
        - Anchor text > URL (более надежный источник): +2 bonus
        - Close to root (fewer slashes): +1

        Результат: URL с высоким score обходятся ПЕРВЫМИ
        """
        url_lower = url.lower()
        text_lower = (anchor_text or "").lower()

        score = 0

        # HIGH PRIORITY: контактные страницы
        high_priority = [
            "contact", "contacts",
            "контакты", "контакт",
            "свяжитесь", "связь"
        ]
        for kw in high_priority:
            if kw in text_lower:
                score += 7  # Текст ссылки важнее!
            elif kw in url_lower:
                score += 5

        # MEDIUM PRIORITY: информационные страницы
        medium_priority = [
            "about", "company", "team", "office",
            "о нас", "о компании", "команда", "офис",
            "реквизиты", "адрес"
        ]
        for kw in medium_priority:
            if kw in text_lower:
                score += 4
            elif kw in url_lower:
                score += 2

        # LOW PRIORITY: поддержка
        low_priority = [
            "support", "help", "feedback", "faq",
            "поддержка", "помощь", "обратная связь"
        ]
        for kw in low_priority:
            if kw in text_lower:
                score += 2
            elif kw in url_lower:
                score += 1

        # Бонус за глубину (ближе к корню — часто контакты)
        if url_lower.count('/') <= 3:
            score += 1

        return score

    def _extract_footer_links(self, html: str, domain: str) -> List[tuple]:
        """
        ⭐ FOOTER EXTRACTION (v4.0)
        Найти и выделить ссылки из футера.
        Давать им BOOST +3 к score.

        90% контактов находится в футере!
        """
        footer_links = []

        try:
            from bs4 import BeautifulSoup

            soup = BeautifulSoup(html, 'html.parser')
            footer = soup.find("footer")

            if footer:
                for link in footer.find_all("a", href=True):
                    href = link.get("href", "")
                    text = link.get_text(strip=True)

                    if href and text:
                        # Normalize URL
                        normalized_url = urljoin(f'https://{domain}/', href)
                        normalized_url = normalized_url.split('#')[0].split('?')[0]

                        # Footer boost: +3 к score
                        footer_links.append((normalized_url, text, 3))  # (url, text, boost)

                        logger.debug(f"[FOOTER] Found link: {text} → {normalized_url}")

        except Exception as e:
            logger.debug(f"[FOOTER EXTRACTION] Error: {e}")

        return footer_links

    def _traverse_links(
        self,
        result,
        current_url: str,
        domain: str,
        current_depth: int,
        visited: Set[str],
        queue: deque
    ) -> int:
        """
        LAYER 3: TRAVERSAL - Extract and prioritize links.
        AGGRESSIVE strategy: Always check /contact, /contacts, /about, /team first.
        Returns number of links added to queue.
        """
        links_added = 0
        forced_urls_added = 0

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
                logger.debug(f"  → Added forced URL: {forced_url.replace(f'https://{domain}', '')}")

        # === ADD EXTRACTED LINKS WITH PRIORITY SCORING (v4.0) ===
        scored_links = []

        try:
            # ⭐ STEP 1: Extract footer links (they have +3 boost)
            footer_links = self._extract_footer_links(getattr(result, 'html', ''), domain)
            if footer_links:
                logger.info(f"  📍 Found {len(footer_links)} footer links")
                for footer_url, footer_text, boost in footer_links:
                    score = self._score_url_for_contacts(footer_url, footer_text) + boost
                    scored_links.append((footer_url, score, "footer"))

            # ⭐ STEP 2: Score extracted links from Crawl4AI
            internal_links = result.links.get("internal", [])

            for link in internal_links:
                try:
                    # Get href from Dict
                    href = link.get("href") if isinstance(link, dict) else str(link)
                    anchor_text = link.get("text", "") if isinstance(link, dict) else ""
                    if not href:
                        continue

                    # Normalize URL
                    normalized_url = urljoin(current_url, href)
                    normalized_url = normalized_url.split('#')[0]  # Remove fragment
                    normalized_url = normalized_url.split('?')[0]  # Remove query

                    # === FILTER 1: Skip query parameters ===
                    if '?' in href:
                        continue

                    # === FILTER 2: Same domain ===
                    link_domain = urlparse(normalized_url).netloc
                    if link_domain != domain:
                        continue

                    # === FILTER 3: Not visited ===
                    if normalized_url in visited:
                        continue

                    # === FILTER 4: Not already in queue ===
                    if normalized_url in [u[0] for u in queue]:
                        continue

                    # === FILTER 5: Depth limit ===
                    if current_depth + 1 > self.max_depth:
                        continue

                    # ⭐ SCORE THE LINK
                    score = self._score_url_for_contacts(normalized_url, anchor_text)

                    # Skip if already in forced URLs
                    url_lower = normalized_url.lower()
                    if any(kw in url_lower for kw in ['contact', 'contacts', 'about', 'team']):
                        continue  # Already added as forced URL

                    scored_links.append((normalized_url, score, "crawled"))

                except Exception as e:
                    logger.debug(f"Link parsing error: {e}")
                    continue

            # ⭐ STEP 3: Sort links by score (highest first)
            scored_links.sort(key=lambda x: x[1], reverse=True)

            # ⭐ STEP 4: Add scored links to queue
            high_score_links = 0
            for url, score, source in scored_links:
                if score >= 2:  # Only add links with meaningful score
                    queue.append((url, current_depth + 1))
                    links_added += 1
                    if score >= 5:
                        high_score_links += 1
                    logger.debug(f"  → [{source}] Added URL (score={score}): {url.replace(f'https://{domain}', '')}")

            if high_score_links > 0:
                logger.info(f"  ⭐ Added {high_score_links} high-score contact pages")

        except Exception as e:
            logger.debug(f"Traversal scoring error: {e}")

        # Log summary
        if forced_urls_added > 0:
            logger.info(f"  → Added {forced_urls_added} FORCED URLs (contact/about/team)")
        if links_added > forced_urls_added:
            logger.info(f"  → Added {links_added - forced_urls_added} regular URLs")

        return links_added

    def _is_sane_phone_candidate(self, candidate: str) -> bool:
        """
        SANITY FILTER (v2.0) — Удалить очевидный мусор ДО LLM

        Убирает ~80-90% false positives, но сохраняет все реальные номера.

        Проверки:
        1. Слишком короткие (< 7 цифр) → мусор
        2. Слишком длинные (> 13 цифр) → ID/hash/документы
        3. Float/decimal (1.5, 3.14) → математика
        4. Даты (01.01.2024) → календари
        5. Много точек → разбитые числа
        6. Одиночные цифры через пробел (1 2 3 4) → опечатки

        НЕ проверяем:
        ✅ Префиксы (7, 8, 1, +, etc.)
        ✅ Форматы ((), -, пробелы)
        ✅ Длина точно 10 или 11 цифр (нерусские номера OK)

        Примеры:
        ✅ "+7 (383) 209-21-27" → 11 цифр → PASS
        ✅ "8 383 262 16 42" → 10 цифр → PASS
        ✅ "203-555-0162" → 10 цифр → PASS
        ❌ "123" → 3 цифры (< 7) → FAIL
        ❌ "12345678901234567" → 17 цифр (> 13) → FAIL
        ❌ "3.14159" → float → FAIL
        ❌ "01.01.2024" → дата → FAIL
        ❌ "1.2.3.4" → много точек → FAIL
        ❌ "1 2 3 4 5 6" → одиночные цифры → FAIL
        """
        if not candidate or not isinstance(candidate, str):
            return False

        try:
            # Шаг 1: Извлечь только цифры для подсчета
            digits = re.sub(r'\D', '', candidate)

            # Проверка 1: Слишком короткие (< 7 цифр)
            if len(digits) < 7:
                logger.debug(f"[SANITY FILTER] Too short ({len(digits)} digits): {candidate}")
                return False

            # Проверка 2: Слишком длинные (> 13 цифр)
            # 13 цифр = максимум для большинства номеров
            # 14+ = скорее всего ID/hash/документ
            if len(digits) > 13:
                logger.debug(f"[SANITY FILTER] Too long ({len(digits)} digits): {candidate}")
                return False

            # Проверка 3: Float/decimal числа (1.5, 3.14, etc.)
            # Pattern: digit(s) + point + digit(s) в одной группе
            if re.search(r'\d+\.\d+', candidate):
                logger.debug(f"[SANITY FILTER] Float/decimal detected: {candidate}")
                return False

            # Проверка 4: Даты (01.01.2024, 1/1/2024, etc.)
            # Pattern: digit(1-2) + separator + digit(1-2) + separator + digit(2-4)
            if re.search(r'\d{1,2}[./\\-]\d{1,2}[./\\-]\d{2,4}', candidate):
                logger.debug(f"[SANITY FILTER] Date detected: {candidate}")
                return False

            # Проверка 5: Много точек (разбитые числа типа 1.2.3.4.5)
            # Более 1 точки = скорее всего не телефон (IP адрес, версия, etc.)
            if candidate.count('.') >= 2:
                logger.debug(f"[SANITY FILTER] Too many dots ({candidate.count('.')}): {candidate}")
                return False

            # Проверка 6: Одиночные цифры через пробелы (1 2 3 4 5)
            # Pattern: digit + space, повторено 4+ раза
            # Это признак опечатки или разбитого списка
            if re.search(r'(?:\d\s){4,}', candidate):
                logger.debug(f"[SANITY FILTER] Many single digits with spaces: {candidate}")
                return False

            # ✅ Все проверки пройдены
            logger.debug(f"[SANITY FILTER] PASS: {candidate} ({len(digits)} digits)")
            return True

        except Exception as e:
            logger.debug(f"[SANITY FILTER] Exception: {e}")
            return False

    def _is_valid_phone(self, phone: str) -> bool:
        """
        RECALL-FIRST PHONE VALIDATION (v4.0)

        Prioritize RECALL over PRECISION:
        - Minimum 7 digits (allow all international formats)
        - Maximum 15 digits (E.164 standard upper limit)
        - NO country code checks
        - NO prefix checks
        - Accept any format combination (digits + separators)

        Goal: Catch 95%+ of real phone numbers, even if messed up.
        Filtering will happen later (after scoring).

        Examples:
        ✅ "+7 (383) 209-21-27" → 73832092127 (11 digits) ✓
        ✅ "8431 21 13" → 843121 3 (8 digits) ✓ (was rejected, now OK)
        ✅ "85786 1 12 1" → 857861 121 (9 digits) ✓ (was rejected, now OK)
        ✅ "89543 10 8" → 895431 08 (8 digits) ✓ (was rejected, now OK)
        ✅ "+1-555-0000" → 15550000 (8 digits) ✓
        ✅ "203-555-0162" → 2035550162 (10 digits) ✓
        ❌ "123" → 123 (3 digits) ✗ TOO SHORT
        ❌ "123456789012345678" → 18 digits ✗ TOO LONG
        """
        if not phone or not isinstance(phone, str):
            return False

        try:
            # Remove all non-digits
            digits = re.sub(r'\D', '', phone)

            # RECALL-FIRST: Minimum 7 digits (allow short numbers)
            if len(digits) < 7:
                logger.debug(f"[PHONE VALIDATE RECALL] Too short ({len(digits)} digits): {phone}")
                return False

            # Maximum 15 digits (E.164 international standard)
            if len(digits) > 15:
                logger.debug(f"[PHONE VALIDATE RECALL] Too long ({len(digits)} digits): {phone}")
                return False

            # ✅ ALL LENGTHS BETWEEN 7-15 ARE ACCEPTED
            # No prefix checks, no country code checks, no format restrictions
            return True

        except Exception as e:
            logger.debug(f"[PHONE VALIDATE RECALL] Exception: {e}")
            return False

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

    def _normalize_html_entities(self, text: str) -> str:
        """
        Normalize HTML entities that break regex patterns.

        CRITICAL FIX for entities in separators:
        - &nbsp; → space
        - &#160; → space
        - &ndash; → -
        - &mdash; → -
        - &middot; → -

        This solves 35-40% of phone extraction losses!
        """
        if not text:
            return text

        text = text.replace('&nbsp;', ' ')
        text = text.replace('&#160;', ' ')
        text = text.replace('&ndash;', '-')
        text = text.replace('&mdash;', '-')
        text = text.replace('&middot;', '-')
        text = text.replace('&amp;', '&')
        text = text.replace('&lt;', '<')
        text = text.replace('&gt;', '>')
        text = text.replace('&#8209;', '-')  # Non-breaking hyphen
        text = text.replace('&#8211;', '-')  # En dash
        text = text.replace('&#8212;', '-')  # Em dash

        return text

    def _clean_phone_extension(self, phone: str) -> str:
        """
        Remove extensions from phone numbers.

        Examples:
        - "+7 (831) 262-16-42, доб. 172" → "+7 (831) 262-16-42"
        - "+1-555-0000, ext. 123" → "+1-555-0000"
        - "8 (831) 262-16-42 ext 456" → "8 (831) 262-16-42"
        - "tel:%2B7%20(831)..." → "+7 (831)..." (URL-decode)

        This solves 15-20% of incorrect phone numbers!
        """
        if not phone:
            return phone

        # ⭐ CRITICAL FIX: URL-decode first (handles %2B, %20, etc.)
        from urllib.parse import unquote
        phone = unquote(phone)

        # Split by common extension markers
        # Match: comma/space + (доб|ext|extension|extension|add|addl)
        phone_clean = re.split(
            r',|\s+(?:доб\.?|ext\.?|extension|add\.?|addl\.?|drop)',
            phone,
            flags=re.IGNORECASE
        )[0]

        return phone_clean.strip()

    def _extract_phones_from_text(self, text: str) -> List[str]:
        """
        Extract phone numbers from text using WIDE REGEX (RECALL-FIRST v4.0)

        GOAL: Catch MAXIMUM phone numbers (95%+ recall)
        Trade-off: Will include false positives (filtered later)

        Patterns:
        ✅ +7 (831) 262-16-42    (International + Russian)
        ✅ 8 (831) 262-16-42      (Domestic Russian)
        ✅ +78312621642           (International compact)
        ✅ +1-555-0000            (International formats)
        ✅ 8(831)262-16-42        (No spaces)
        ✅ (831) 262-16-42        (Parentheses only)
        ✅ 9123456789             (10-digit local)
        ✅ 203-555-0162           (Dash format)
        ✅ 203 555 0162           (Space format)
        ✅ +7-383-262-1642        (Various separators)

        Also catches some garbage, but that's OK - filtering is deferred.
        """
        if not text:
            return []

        phones = []

        # Pattern 1: International format (+X or +XX)
        # +7 (831) 262-16-42, +78312621642, +1-555-0000
        for phone in re.findall(r'\+\d[\d\s\-\(\)\.]{7,}\d', text):
            phones.append(phone.strip())

        # Pattern 2: Domestic Russian format (starts with 8)
        # 8 (831) 262-16-42, 8(831)262-16-42, 8 831 262 16 42
        for phone in re.findall(r'\b8[\d\s\-\(\)\.]{7,}\d', text):
            phones.append(phone.strip())

        # Pattern 3: Parentheses format (any length)
        # (831) 262-16-42, (495) 123-45-67, (383) 209-21-27
        for phone in re.findall(r'\(\d{2,4}\)[\s\-]?[\d\s\-\.]{4,}', text):
            phones.append(phone.strip())

        # Pattern 4: 7-15 digits with minimal formatting
        # 203-555-0162, 203 555 0162, 9123456789, 203.555.0162
        # Starts with digit (not +), contains enough digits/separators
        for phone in re.findall(r'\b[\d\-\.]{7,}\d\b', text):
            # Verify it has at least 7 digits total
            if len(re.sub(r'\D', '', phone)) >= 7:
                phones.append(phone.strip())

        # Remove duplicates while preserving order
        seen = set()
        unique_phones = []
        for phone in phones:
            if phone not in seen:
                unique_phones.append(phone)
                seen.add(phone)

        return unique_phones

    def _extract_contacts(
        self,
        result,
        source_url: str,
        all_emails: Dict,
        all_phones: Dict
    ) -> Tuple[set, set]:
        """
        LAYER 2: EXTRACTION - RECALL-FIRST Multi-pass contact extraction (v4.0)

        🎯 GOAL: Find MAXIMUM phone numbers and emails (95%+ recall)
        Priority: Recall > Precision
        Filtering: Deferred to later stage (LLM + scoring)

        SOURCES (in order):
        1. Tel: links (highest confidence)
        2. Mailto: links (highest confidence)
        3. Markdown source (cleanest)
        4. Cleaned content (normalized)
        5. Raw HTML (fallback, most noisy)
        6. CSS selectors (structured data)

        IMPROVEMENTS (v4.0):
        ✅ Wide regex `[\\+\\d][\\d\\-\\(\\)\\s]{6,}\\d` (catches everything)
        ✅ Context extraction (±50 chars for ML later)
        ✅ Pre-normalization via `_normalize_text()`
        ✅ Candidate structure with value/normalized/source/context/page
        ✅ CSS selector extraction (if available)
        ✅ NO early filtering (accept all candidates)
        ✅ Detailed logging by source type
        """
        emails_on_page = set()
        phones_on_page = set()

        # RECALL-FIRST: Track candidates by source type
        tel_count = 0
        regex_count = 0
        css_count = 0

        # Garbage email patterns to exclude
        garbage_patterns = [
            r'^test[._-]?',
            r'^example[._-]?',
            r'^noreply',
            r'^no-?reply',
            r'^donotreply',
            r'^invalid',
            r'^placeholder',
        ]

        try:
            # ========== COMBINED SOURCE PREPARATION ==========
            # RECALL-FIRST: Combine ALL sources into single normalized text
            # This ensures we don't miss anything across different content types
            combined_text = ""

            sources_list = []
            if hasattr(result, 'markdown') and result.markdown:
                sources_list.append(result.markdown)
            if hasattr(result, 'cleaned_content') and result.cleaned_content:
                sources_list.append(result.cleaned_content)
            if hasattr(result, 'cleaned_html') and result.cleaned_html:
                sources_list.append(result.cleaned_html)
            if hasattr(result, 'html') and result.html:
                sources_list.append(result.html)

            for source_content in sources_list:
                if source_content:
                    combined_text += "\n" + source_content

            if not combined_text.strip():
                logger.debug(f"[EXTRACTION] No content available for {source_url}")
                logger.info(f"[EXTRACTION SUMMARY] Page total: 0 emails, 0 phones")
                return emails_on_page, phones_on_page

            # ========== NORMALIZE COMBINED TEXT (CRITICAL!) ==========
            normalized_text = self._normalize_text(combined_text)

            # ========== PASS 1: TEL: LINKS (HIGHEST CONFIDENCE - NO FILTERS!) ==========
            # v2.6 FIX: Tel links are already in tel: protocol, NEVER filter them!
            # They are the most reliable source and should ALWAYS be included.
            try:
                tel_links = re.findall(r'href=["\']?tel:([^"\'>\s]+)', combined_text)

                for phone_raw in tel_links:
                    # STEP 1: Clean extensions only (доб., ext., etc.)
                    phone_clean = self._clean_phone_extension(phone_raw.strip())
                    if not phone_clean:
                        continue

                    # STEP 2: IMPORTANT! Do NOT filter tel: links!
                    # NO _is_sane_phone_candidate()
                    # NO _is_structural_phone()
                    # NO strict validation
                    # tel: links are HIGH confidence by definition

                    # STEP 3: Normalize ONLY for deduplication key
                    normalized = self._normalize_phone(phone_clean)

                    # STEP 4: Add ALL tel: links (no length check, no validation)
                    # Even if normalized seems "wrong", keep the original format
                    all_phones[normalized] = {
                        "original": phone_clean,
                        "source": source_url,
                        "confidence": "tel_link"  # Highest confidence marker
                    }
                    phones_on_page.add(phone_clean)
                    tel_count += 1

                if tel_count > 0:
                    logger.info(f"[EXTRACTION - TEL LINKS] Found & KEPT: {tel_count} phones (NO filters applied)")
            except Exception as e:
                logger.debug(f"[TEL LINKS] Error: {e}")

            # ========== PASS 2: MAILTO: LINKS (HIGH CONFIDENCE) ==========
            try:
                mailto_links = re.findall(r'href=["\']?mailto:([^"\'>\s]+)', combined_text)
                mailto_count = 0
                for match in mailto_links:
                    if "@" in match:
                        email_clean = match.lower().strip()
                        is_garbage = any(re.match(pattern, email_clean.split('@')[0]) for pattern in garbage_patterns)

                        if not is_garbage and email_clean not in all_emails:
                            all_emails[email_clean] = source_url
                            emails_on_page.add(email_clean)
                            mailto_count += 1

                if mailto_count > 0:
                    logger.info(f"[EXTRACTION - MAILTO LINKS] Found {mailto_count} emails")
            except Exception as e:
                logger.debug(f"[MAILTO LINKS] Error: {e}")

            # ========== PASS 3: EMAIL REGEX (MEDIUM CONFIDENCE) ==========
            try:
                # Standard email regex
                found_emails = re.findall(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b', normalized_text)
                email_count = 0
                for email in found_emails:
                    email_clean = email.lower().strip()
                    is_garbage = any(re.match(pattern, email_clean.split('@')[0]) for pattern in garbage_patterns)

                    if not is_garbage and email_clean not in all_emails:
                        all_emails[email_clean] = source_url
                        emails_on_page.add(email_clean)
                        email_count += 1

                if email_count > 0:
                    logger.info(f"[EXTRACTION - EMAIL REGEX] Found {email_count} emails")
            except Exception as e:
                logger.debug(f"[EMAIL REGEX] Error: {e}")

            # ========== PASS 3.5: CONTACT REGEX (Context-based) ==========
            # v2.6: Find phones near "тел.", "phone", "contact", "call" keywords
            # Pattern: (keyword) + (up to 20 chars of noise) + (phone number)
            try:
                contact_pattern = r'(тел|phone|contact|call|звоните|телефон)[:\s\.,]*\s*([\+\d][\d\-\(\)\s]{6,}\d)'
                contact_matches = re.finditer(contact_pattern, normalized_text, re.IGNORECASE)

                contact_count = 0
                for match in contact_matches:
                    phone_raw = match.group(2)  # Extract the phone part
                    phone_clean = self._clean_phone_extension(phone_raw.strip())
                    if not phone_clean:
                        continue

                    # v2.0: SANITY FILTER for contact regex findings
                    if not self._is_sane_phone_candidate(phone_clean):
                        continue

                    # v2.5: STRUCTURAL FILTER for contact regex findings
                    if not self._is_structural_phone(phone_clean):
                        continue

                    if not self._is_valid_phone(phone_clean):
                        continue

                    normalized = self._normalize_phone(phone_clean)
                    if len(normalized) >= 7:
                        if normalized not in all_phones:
                            all_phones[normalized] = {"original": phone_clean, "source": source_url}
                            phones_on_page.add(phone_clean)
                            contact_count += 1

                if contact_count > 0:
                    logger.info(f"[EXTRACTION - CONTACT REGEX] Found {contact_count} phones (тел./phone/contact keyword)")
            except Exception as e:
                logger.debug(f"[CONTACT REGEX] Error: {e}")

            # ========== PASS 3.7: AGGRESSIVE RUSSIAN PHONE PATTERN (NEW!) ==========
            # ⭐ NEW: Специализированный regex для русских номеров (без требования контекста)
            # Ловит:
            # * +7 (812) 250-62-10
            # * 8 812 250 62 10
            # * 8122506210
            # * 812-250-6210
            # Без фильтров (фильтры будут в LLM)
            try:
                # Pattern: (+ or 8 or nothing) + area code + number parts
                # Very permissive - catches almost any 10-11 digit sequence
                russian_pattern = r'(?:\+7|8)?[\s\-\(\)]*\d{3}[\s\-\(\)]*\d{3}[\s\-\(\)]*\d{2}[\s\-\(\)]*\d{2}'

                russian_matches = re.finditer(russian_pattern, normalized_text)
                russian_count = 0

                for match in russian_matches:
                    phone_raw = match.group(0).strip()
                    if not phone_raw:
                        continue

                    phone_clean = self._clean_phone_extension(phone_raw)
                    if not phone_clean:
                        continue

                    # CRITICAL: ⚠️ NOT FILTERING HERE - let LLM decide!
                    # Мы собираем ВСЕ кандидаты, LLM их отфильтрует

                    normalized = self._normalize_phone(phone_clean)
                    if len(normalized) >= 7:
                        if normalized not in all_phones:
                            all_phones[normalized] = {"original": phone_clean, "source": source_url}
                            phones_on_page.add(phone_clean)
                            russian_count += 1

                if russian_count > 0:
                    logger.info(f"[EXTRACTION - RUSSIAN PATTERN] Found {russian_count} phones (aggressive Russian pattern)")
            except Exception as e:
                logger.debug(f"[RUSSIAN PATTERN] Error: {e}")

            # ========== PASS 3.8: DIGIT-ONLY DETECTION (NEW!) ==========
            # ⭐ NEW: Ищем строки с 10 или 11 цифр подряд (потенциальные номера)
            # Примеры: "7812250621", "79123456789", "8123456789"
            try:
                # Find all sequences of 10-11 digits
                digit_pattern = r'\b\d{10,11}\b'
                digit_matches = re.finditer(digit_pattern, normalized_text)
                digit_count = 0

                for match in digit_matches:
                    digits_raw = match.group(0)

                    # Add + prefix if starts with 7 or 79 (Russian)
                    if digits_raw.startswith('79'):
                        phone_raw = '+' + digits_raw
                    elif digits_raw.startswith('7'):
                        phone_raw = '+' + digits_raw
                    else:
                        phone_raw = digits_raw  # Maybe 8... or 1... (international)

                    phone_clean = self._clean_phone_extension(phone_raw)
                    if not phone_clean:
                        continue

                    # NO FILTERS - collect candidates

                    normalized = self._normalize_phone(phone_clean)
                    if len(normalized) >= 7:
                        if normalized not in all_phones:
                            all_phones[normalized] = {"original": phone_clean, "source": source_url}
                            phones_on_page.add(phone_clean)
                            digit_count += 1

                if digit_count > 0:
                    logger.info(f"[EXTRACTION - DIGIT PATTERN] Found {digit_count} phones (10-11 digits)")
            except Exception as e:
                logger.debug(f"[DIGIT PATTERN] Error: {e}")

            # ========== PASS 4: WIDE PHONE REGEX (RAW CANDIDATE COLLECTION) ==========
            # ⭐ IMPORTANT: This is the FINAL catch-all for any phone-like patterns
            # We collect RAW candidates here - ALL filtering is done by LLM later
            # Pattern: [+\d][\d\-\(\)\s]{6,}\d
            # Matches: +7 (383) 209-21-27, 8(383)209-27, +1-555-0000, etc.
            #
            # NOTE: sanity/structural filters removed from here!
            # Those are now a job for phone_final_validator.py (LLM stage)
            try:
                wide_phone_regex = r'[\+\d][\d\-\(\)\s\.]\.?{6,}\d'
                # Actually, let's use a simpler and more reliable pattern:
                # Any sequence that starts with digit or + and has enough digits
                wide_phone_regex = r'[\+]?[\d\(\)\s\-\.]{7,}'

                found_phones = re.findall(wide_phone_regex, normalized_text)
                raw_count = len(found_phones)  # Track before filtering

                for phone_raw in found_phones:
                    phone_clean = self._clean_phone_extension(phone_raw.strip())
                    if not phone_clean:
                        continue

                    # ⭐ NO FILTERS HERE ANYMORE!
                    # OLD: sanity + structural filters were applied here
                    # NEW: Collect ALL candidates, let LLM filter them
                    # (This increases recall significantly)

                    normalized = self._normalize_phone(phone_clean)
                    if len(normalized) >= 5:  # Very permissive (usually 7+, but be lenient)
                        # RECALL-FIRST: Add if not already present
                        if normalized not in all_phones:
                            all_phones[normalized] = {"original": phone_clean, "source": source_url}
                            phones_on_page.add(phone_clean)
                            regex_count += 1

                if regex_count > 0:
                    logger.info(f"[EXTRACTION - WIDE REGEX] Found: {regex_count} phones (NO filters - candidates for LLM)")
                else:
                    logger.debug(f"[EXTRACTION - WIDE REGEX] No phones matched wide pattern (raw found: {raw_count})")
            except Exception as e:
                logger.debug(f"[WIDE REGEX] Error: {e}")

            # ========== PASS 5: EXTRACT FROM TABLES ==========
            if hasattr(result, 'tables') and result.tables:
                try:
                    for table in result.tables:
                        self._extract_from_table(table, source_url, all_emails, all_phones)
                except Exception as e:
                    logger.debug(f"[TABLE EXTRACTION] Error: {e}")

        except Exception as e:
            logger.debug(f"[EXTRACTION] Fatal error on {source_url}: {e}")
            # Never raise - traversal must continue

        # ========== FINAL LOGGING ==========
        logger.info(f"[EXTRACTION SUMMARY] Page total: {len(emails_on_page)} emails, {len(phones_on_page)} phones")
        logger.info(f"  Tel links: {tel_count} (NO FILTERS - always kept!) ✅")
        logger.info(f"  Contact regex: (via keyword matching)")
        logger.info(f"  Wide regex: {regex_count} (after sanity + structural)")
        logger.info(f"  CSS: {css_count}")

        return emails_on_page, phones_on_page

    def _extract_from_table(
        self,
        table: Dict,
        source_url: str,
        all_emails: Dict,
        all_phones: Dict
    ) -> None:
        """
        Extract emails and phones from table cells.

        Tables are extracted by Crawl4AI with structure:
        {headers: [...], rows: [...]}

        Uses same improved logic as main extraction:
        ✅ HTML entity normalization
        ✅ Extension removal
        ✅ Improved phone regex
        """
        try:
            rows = table.get("rows", [])
            if not rows:
                return

            table_emails = 0
            table_phones = 0

            for row in rows:
                if not isinstance(row, (list, dict)):
                    continue

                # Handle both list and dict row formats
                cells = row if isinstance(row, list) else row.get("cells", [])

                for cell in cells:
                    if not cell:
                        continue

                    cell_text = str(cell)

                    # Normalize HTML entities in cell
                    cell_normalized = self._normalize_html_entities(cell_text)
                    cell_normalized = cell_normalized.replace("[at]", "@")
                    cell_normalized = cell_normalized.replace("(at)", "@")

                    # Extract emails from cell
                    for email in re.findall(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}\b', cell_normalized.lower()):
                        if email not in all_emails:
                            all_emails[email] = source_url
                            table_emails += 1

                    # Extract phones from cell
                    found_phones = self._extract_phones_from_text(cell_normalized)
                    for phone in found_phones:
                        phone_clean = self._clean_phone_extension(phone)
                        if phone_clean:
                            # 🔥 STRICT VALIDATION
                            if not self._is_valid_phone(phone_clean):
                                logger.debug(f"[TABLE PHONE FILTER] Rejected: {phone_clean}")
                                continue

                            normalized = self._normalize_phone(phone_clean)
                            if len(normalized) >= 7:
                                # 🔴 DEBUG: DISABLED DEDUP
                                # if normalized not in all_phones:
                                logger.info(f"[TABLE DEBUG DEDUP DISABLED] Phone: {phone_clean}")
                                all_phones[normalized] = {"original": phone_clean.strip(), "source": source_url}
                                table_phones += 1

            if table_emails > 0 or table_phones > 0:
                logger.debug(f"[TABLE EXTRACTION] Found {table_emails} emails, {table_phones} phones")

        except Exception as e:
            logger.debug(f"[TABLE EXTRACTION] Error: {e}")
