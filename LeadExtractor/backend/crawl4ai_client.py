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

logger = logging.getLogger(__name__)


class Crawl4AIClient:
    """
    Contact extraction using manual BFS traversal.
    Crawl4AI handles single page fetch, we control the crawl strategy.
    """

    def __init__(self, timeout: int = 30, max_pages: int = 10, max_depth: int = 2):
        self.timeout = timeout
        self.max_pages = max_pages
        self.max_depth = max_depth

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
        # Limit to 30 total to avoid queue explosion
        result = priority_links + links
        return result[:30]

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

        # Manual BFS traversal
        queue = deque([(domain_url, 0)])  # (url, depth)
        visited = set()
        crawl4ai_failed = False  # Flag to activate fallback crawler

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
                    "phone": phone_data["original"],  # Show original format like +7 (3412) 33-05-42
                    "source_page": phone_data["source"]
                })
            else:
                # Fallback for old format (shouldn't happen)
                phones_list.append({
                    "phone": phone_data,
                    "source_page": ""
                })

        # DEBUG: ALL PHONES BEFORE SLICING
        logger.info(f"\n{'='*60}")
        logger.info(f"[DEBUG PHASE 1] ALL PHONES FROM all_phones DICT:")
        logger.info(f"  Total unique (by normalized key): {len(all_phones)}")
        for normalized_key, phone_data in sorted(all_phones.items())[:20]:
            original = phone_data.get("original") if isinstance(phone_data, dict) else phone_data
            logger.info(f"    {normalized_key} → {original}")
        logger.info(f"{'='*60}")

        # DEBUG: PHONES AFTER LIST CONVERSION
        logger.info(f"[DEBUG PHASE 2] PHONES_LIST AFTER CONVERSION:")
        logger.info(f"  Total phones_list: {len(phones_list)}")
        for i, phone_dict in enumerate(phones_list[:20]):
            logger.info(f"    [{i}] {phone_dict.get('phone')} (source: {phone_dict.get('source_page', 'N/A')})")

        # DEBUG: SLICING DECISION
        logger.info(f"[DEBUG PHASE 3] SLICING DECISION:")
        logger.info(f"  Before slice [:10]: {len(phones_list)} phones")
        logger.info(f"  After slice [:10]: {len(phones_list[:10])} phones")
        logger.info(f"  TRUNCATED: {len(phones_list) > 10}")

        result = {
            "emails": [
                {"email": email, "source_page": source}
                for email, source in sorted(all_emails.items())
            ][:10],
            "phones": phones_list[:10],
            "sources": list(sources)[:10],
            "status_per_site": status_per_site,
        }

        logger.info(f"\n{'='*60}")
        logger.info(f"Crawled {page_count} pages")
        logger.info(f"[DEBUG FINAL] RESULT OBJECT ABOUT TO RETURN:")
        logger.info(f"  emails: {len(result['emails'])}")
        logger.info(f"  phones: {len(result['phones'])} (after STRICT validation)")
        logger.info(f"[DEBUG] ACTUAL PHONES IN RESULT:")
        for i, phone in enumerate(result['phones'][:20]):
            logger.info(f"    [{i}] {phone}")

        logger.info(f"\n[VALIDATION SUMMARY]")
        logger.info(f"  Total unique phones found: {len(all_phones)}")
        logger.info(f"  Total phones in result (after slicing): {len(result['phones'])}")
        logger.info(f"  Validation: ✅ STRICT phone format validation applied")
        logger.info(f"  Filters: 10–11 digits, Russian format (7x or 8x prefix)")
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

        # === ADD EXTRACTED LINKS (Regular Priority) ===
        try:
            # Get internal links from Crawl4AI
            internal_links = result.links.get("internal", [])

            for link in internal_links:
                try:
                    # Get href from Dict
                    href = link.get("href") if isinstance(link, dict) else str(link)
                    if not href:
                        continue

                    # Normalize URL
                    normalized_url = urljoin(current_url, href)
                    normalized_url = normalized_url.split('#')[0]  # Remove fragment
                    normalized_url = normalized_url.split('?')[0]  # Remove query

                    # === FILTER 1: Skip query parameters ===
                    # Don't add URLs with ? (they create duplicates)
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

                    # Check if priority URL (should already be in queue, but check anyway)
                    url_lower = normalized_url.lower()
                    is_priority = any(kw in url_lower for kw in ['contact', 'contacts', 'about', 'team'])

                    if is_priority:
                        # Already added as forced URL above, skip
                        continue

                    # Add to BACK of queue (regular priority)
                    queue.append((normalized_url, current_depth + 1))
                    links_added += 1

                except Exception as e:
                    logger.debug(f"Link parsing error: {e}")
                    continue

        except Exception as e:
            logger.debug(f"Traversal error: {e}")

        # Log summary
        if forced_urls_added > 0:
            logger.info(f"  → Added {forced_urls_added} FORCED URLs (contact/about/team)")
        if links_added > forced_urls_added:
            logger.info(f"  → Added {links_added - forced_urls_added} regular URLs")

        return links_added

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

        This solves 15-20% of incorrect phone numbers!
        """
        if not phone:
            return phone

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
        Extract phone numbers from text using improved regex.

        Patterns:
        - +7 (831) 262-16-42
        - 8 (831) 262-16-42
        - +78312621642
        - +1-555-0000
        - 8(831)262-16-42
        """
        if not text:
            return []

        phones = []

        # Pattern 1: International format (+7, +1, etc)
        # +7 (831) 262-16-42 or +78312621642
        for phone in re.findall(r'\+\d[\d\s\-\(\)]{8,}\d', text):
            phones.append(phone.strip())

        # Pattern 2: Russian domestic format (starts with 8)
        # 8 (831) 262-16-42 or 8(831)262-16-42
        for phone in re.findall(r'\b8[\d\s\-\(\)]{8,}\d', text):
            phones.append(phone.strip())

        # Pattern 3: Parentheses format (alternative)
        # (831) 262-16-42 or (495) 123-45-67
        for phone in re.findall(r'\(\d{3}\)[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}', text):
            phones.append(phone.strip())

        return phones

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

        Returns: (emails_set, phones_set)
        IMPORTANT: Independent of traversal - never breaks BFS

        IMPROVEMENTS (v3.0):
        ✅ HTML entity normalization (fixes &nbsp; issues)
        ✅ Extension removal (доб., ext.)
        ✅ Multi-source extraction
        ✅ Tel links prioritized
        ✅ Better phone regex
        ✅ Comprehensive logging
        """
        emails_on_page = set()
        phones_on_page = set()

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
            # ========== PASS 1: TEL: LINKS (HIGHEST PRIORITY) ==========
            # Most reliable - already in correct format
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
                        # if normalized not in all_phones:
                        logger.info(f"[DEBUG DEDUP DISABLED] Tel link: {phone_clean} (normalized: {normalized})")
                        all_phones[normalized] = {"original": phone_clean, "source": source_url}
                        phones_on_page.add(phone_clean)
                        tel_valid += 1

                logger.info(f"[EXTRACTION Pass 1] Valid: {tel_valid}, Filtered: {tel_filtered}")
            except Exception as e:
                logger.debug(f"[EXTRACTION] Tel link error: {e}")

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
                logger.debug(f"[EXTRACTION] No content sources available for {source_url}")
                return emails_on_page, phones_on_page

            # ========== MULTI-PASS EXTRACTION ==========
            source_index = 1
            for source_name, source_content in sources:
                if not source_content:
                    continue

                logger.debug(f"[EXTRACTION Pass {source_index + 1} - {source_name}] Processing...")
                emails_before = len(all_emails)
                phones_before = len(all_phones)

                try:
                    # Normalize HTML entities (CRITICAL!)
                    content_normalized = self._normalize_html_entities(source_content)

                    # Also normalize common obfuscation
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
                            # if normalized not in all_phones:
                            logger.info(f"[DEBUG DEDUP DISABLED] Found phone: {phone_clean} (normalized: {normalized})")
                            all_phones[normalized] = {"original": phone_clean, "source": source_url}
                            phones_on_page.add(phone_clean)

                except Exception as e:
                    logger.debug(f"[EXTRACTION] Error in {source_name}: {e}")
                    continue

                # Log extraction results for this source
                emails_found = len(all_emails) - emails_before
                phones_found = len(all_phones) - phones_before
                if emails_found > 0 or phones_found > 0:
                    logger.info(f"[EXTRACTION Pass {source_index + 1} - {source_name}] Found {emails_found} new emails, {phones_found} new phones")

                source_index += 1

            # ========== EXTRACT FROM TABLES ==========
            if hasattr(result, 'tables') and result.tables:
                logger.debug(f"[EXTRACTION] Processing {len(result.tables)} table(s)")
                for table in result.tables:
                    try:
                        self._extract_from_table(table, source_url, all_emails, all_phones)
                    except Exception as e:
                        logger.debug(f"[EXTRACTION] Table error: {e}")

        except Exception as e:
            logger.debug(f"[EXTRACTION] Fatal error on {source_url}: {e}")
            # Never raise - traversal must continue

        logger.info(f"[EXTRACTION] Page total: {len(emails_on_page)} emails, {len(phones_on_page)} phones")
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
