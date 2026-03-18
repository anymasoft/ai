"""
Crawl4AI 0.8.x BFS traversal for contact extraction.
ARCHITECTURE: 3 independent layers (FETCH → EXTRACTION → TRAVERSAL)
Each layer is protected from errors in other layers.
"""

import asyncio
import re
import logging
import requests
from typing import Dict, List, Set, Optional, Tuple
from urllib.parse import urljoin, urlparse
from collections import deque

logger = logging.getLogger(__name__)


class Crawl4AIClient:
    """
    Multi-page BFS crawler with separated layers.
    - FETCH: Gets page from Crawl4AI
    - EXTRACTION: Extracts emails/phones (independent)
    - TRAVERSAL: Finds links (independent)
    """

    def __init__(self, timeout: int = 30, max_pages: int = 5, max_depth: int = 2):
        self.timeout = timeout
        self.max_pages = max_pages
        self.max_depth = max_depth
        self.PRIORITY_PATTERNS = [
            'contact', 'about', 'team', 'company', 'support',
            'контакты', 'о-нас', 'команда', 'компани', 'служба'
        ]

    def _fallback_fetch(self, url: str) -> str:
        """
        Fallback fetch using requests when Crawl4AI fails.
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

    async def extract(self, domain_url: str) -> Dict:
        """
        BFS traversal with 3-layer architecture.
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

        # Global storage
        all_emails = {}  # {email: source_page}
        all_phones = {}  # {phone: source_page}
        visited = set()
        sources = set()
        status_per_site = {}  # Track status for each crawled page

        # BFS queue: (url, depth)
        queue = deque([(domain_url, 0)])

        try:
            async with AsyncWebCrawler() as crawler:

                while queue and len(visited) < self.max_pages:
                    current_url, depth = queue.popleft()

                    # Skip if already visited
                    if current_url in visited:
                        continue

                    # Skip if exceeds max depth
                    if depth > self.max_depth:
                        continue

                    visited.add(current_url)

                    # Format URL for logging
                    short_url = current_url.replace(f'https://{domain}', '')[:50]
                    logger.info(f"\n[Page {len(visited)}/{self.max_pages}] Depth {depth} → {short_url}")

                    # ============================================
                    # LAYER 1: FETCH
                    # ============================================
                    result, page_status = await self._fetch_page(crawler, current_url)
                    if result is None:
                        if page_status == "blocked":
                            status_per_site[current_url] = "blocked"
                            sources.add(current_url)
                        continue

                    sources.add(current_url)
                    status_per_site[current_url] = page_status

                    # ============================================
                    # LAYER 2: EXTRACTION (INDEPENDENT)
                    # ============================================
                    emails_on_page, phones_on_page = self._extract_contacts(result, current_url, all_emails, all_phones)

                    if emails_on_page or phones_on_page:
                        logger.info(f"  Found {len(emails_on_page)} emails, {len(phones_on_page)} phones")

                    # ============================================
                    # LAYER 3: TRAVERSAL (INDEPENDENT)
                    # ============================================
                    self._traverse_links(result, current_url, domain, depth, visited, queue)

        except Exception as e:
            logger.error(f"Fatal error: {e}", exc_info=True)

        # Build result
        result = {
            "emails": [
                {"email": email, "source_page": source}
                for email, source in sorted(all_emails.items())
            ][:10],
            "phones": [
                {"phone": phone, "source_page": source}
                for phone, source in sorted(all_phones.items())
            ][:10],
            "sources": list(sources)[:10],
            "status_per_site": status_per_site,
        }

        logger.info(f"\n{'='*60}")
        logger.info(f"Crawled {len(visited)} pages")
        logger.info(f"Found {len(result['emails'])} emails, {len(result['phones'])} phones")
        logger.info(f"{'='*60}\n")

        return result

    async def _fetch_page(self, crawler, url: str) -> Tuple[Optional[object], str]:
        """
        LAYER 1: FETCH - Get page from Crawl4AI with fallback
        Returns (CrawlResult, status) or (None, status)
        Status: "success", "fallback_success", "blocked"

        Errors here DON'T affect extraction or traversal
        """
        try:
            from crawl4ai import CrawlerRunConfig

            config = CrawlerRunConfig(
                wait_until="networkidle",
                page_timeout=self.timeout * 1000,
                word_count_threshold=5,
                scan_full_page=True,
                remove_overlay_elements=True,
                process_iframes=True,
            )

            result = await asyncio.wait_for(
                crawler.arun(url=url, config=config),
                timeout=self.timeout + 5
            )

            if not result.success:
                logger.warning(f"  Crawl4AI failed, trying fallback...")
                fallback_html = self._fallback_fetch(url)

                if fallback_html:
                    # Create a mock result object with fallback HTML
                    class FallbackResult:
                        def __init__(self, html_content):
                            self.html = html_content
                            self.cleaned_html = ""
                            self.extracted_content = ""
                            self.links = {"internal": []}
                            self.success = True

                    result = FallbackResult(fallback_html)
                    logger.info(f"  Fallback fetch succeeded")
                    return result, "fallback_success"
                else:
                    logger.warning(f"  Site blocked or protected")
                    return None, "blocked"

            logger.info(f"  Crawl4AI succeeded")
            return result, "success"

        except asyncio.TimeoutError:
            logger.warning(f"  Timeout, trying fallback...")
            fallback_html = self._fallback_fetch(url)

            if fallback_html:
                class FallbackResult:
                    def __init__(self, html_content):
                        self.html = html_content
                        self.cleaned_html = ""
                        self.extracted_content = ""
                        self.links = {"internal": []}
                        self.success = True

                result = FallbackResult(fallback_html)
                logger.info(f"  Fallback fetch succeeded after timeout")
                return result, "fallback_success"
            else:
                logger.warning(f"  Site blocked (timeout)")
                return None, "blocked"

        except Exception as e:
            logger.warning(f"  Fetch error: {e}, trying fallback...")
            fallback_html = self._fallback_fetch(url)

            if fallback_html:
                class FallbackResult:
                    def __init__(self, html_content):
                        self.html = html_content
                        self.cleaned_html = ""
                        self.extracted_content = ""
                        self.links = {"internal": []}
                        self.success = True

                result = FallbackResult(fallback_html)
                logger.info(f"  Fallback fetch succeeded after error")
                return result, "fallback_success"
            else:
                logger.warning(f"  Site blocked")
                return None, "blocked"

    def _extract_contacts(self, result, source_url: str, all_emails: Dict, all_phones: Dict) -> tuple:
        """
        LAYER 2: EXTRACTION - Extract emails and phones (enhanced)
        Returns (emails_set, phones_set)

        CRITICAL: This layer is INDEPENDENT from traversal
        If it fails, traversal still runs

        Enhanced extraction:
        - mailto: links
        - Text normalization ([at] → @, (at) → @)
        - Multiple HTML sources
        - Garbage filtering (test@, example@, noreply@)
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
            # Prepare content sources
            html = result.html or ""
            fallback = result.cleaned_html or result.extracted_content or ""
            combined = f"{html} {fallback}"

            # Normalize common obfuscation patterns
            combined_normalized = combined.replace("[at]", "@").replace("(at)", "@").replace(" at ", "@")

            # Extract emails from all sources
            try:
                # Standard regex extraction
                for email in re.findall(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', combined_normalized):
                    email_clean = email.lower().strip()

                    # Filter garbage emails
                    is_garbage = any(re.match(pattern, email_clean.split('@')[0]) for pattern in garbage_patterns)
                    if is_garbage:
                        continue

                    if email_clean not in emails_on_page:
                        all_emails[email_clean] = source_url
                        emails_on_page.add(email_clean)

                # Extract from mailto: links
                for match in re.findall(r'href=["\']?mailto:([^"\'>\s]+)', html):
                    if "@" in match:
                        email_clean = match.lower().strip()

                        # Filter garbage
                        is_garbage = any(re.match(pattern, email_clean.split('@')[0]) for pattern in garbage_patterns)
                        if is_garbage:
                            continue

                        if email_clean not in emails_on_page:
                            all_emails[email_clean] = source_url
                            emails_on_page.add(email_clean)

                # Priority: extract from contact/contact-us pages first
                if any(p in source_url.lower() for p in ['contact', 'about', 'team']):
                    # More aggressive extraction on contact pages
                    for match in re.findall(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}', combined_normalized):
                        email_clean = match.lower().strip()

                        is_garbage = any(re.match(pattern, email_clean.split('@')[0]) for pattern in garbage_patterns)
                        if is_garbage:
                            continue

                        if email_clean not in emails_on_page:
                            all_emails[email_clean] = source_url
                            emails_on_page.add(email_clean)

            except Exception as e:
                logger.debug(f"Email extraction error: {e}")

            # Extract phones from all sources
            try:
                for phone in re.findall(r'\+[\d\s\-()]{10,}', combined):
                    # Validate: at least 7 digits
                    digits = len(re.sub(r'\D', '', phone))
                    if digits >= 7:
                        phone_clean = phone.strip()
                        if phone_clean not in phones_on_page:
                            all_phones[phone_clean] = source_url
                            phones_on_page.add(phone_clean)

                # Extract from tel: links
                for phone in re.findall(r'href=["\']?tel:([^"\'>\s]+)', html):
                    digits = len(re.sub(r'\D', '', phone))
                    if digits >= 7:
                        phone_clean = phone.strip()
                        if phone_clean not in phones_on_page:
                            all_phones[phone_clean] = source_url
                            phones_on_page.add(phone_clean)
            except Exception as e:
                logger.debug(f"Phone extraction error: {e}")

        except Exception as e:
            logger.warning(f"Extraction layer error on {source_url}: {e}")
            # CRITICAL: Do NOT re-raise! Just return empty sets

        return emails_on_page, phones_on_page

    def _traverse_links(self, result, source_url: str, domain: str, depth: int, visited: Set, queue: deque):
        """
        LAYER 3: TRAVERSAL - Extract and process links

        CRITICAL: This layer is INDEPENDENT from extraction
        If extraction fails, traversal still runs

        Handles:
        - result.links is Dict[str, List[Dict]]
        - Each link is Dict with 'href' key
        - Filters by domain, visited, depth
        - Prioritizes contact/about/team pages
        """
        try:
            # Get internal links (each is a Dict)
            links = result.links.get("internal", []) if result.links else []
            logger.info(f"  Found {len(links)} links")

            priority_links = []
            other_links = []

            for link in links:
                if not link:
                    continue

                try:
                    # CRITICAL FIX: link is a Dict, use .get() or isinstance check
                    if isinstance(link, dict):
                        href = link.get("href", "")
                    else:
                        # Fallback for Link objects
                        href = getattr(link, 'href', '')

                    if not href:
                        continue

                    # Normalize URL: remove fragments and query params
                    clean_link = href.split('#')[0].split('?')[0].rstrip('/')
                    if not clean_link:
                        continue

                    # Convert to absolute URL
                    full_url = urljoin(source_url, clean_link)

                    # Check domain matches
                    link_domain = urlparse(full_url).netloc
                    if link_domain != domain:
                        continue

                    # Check if already visited
                    if full_url in visited:
                        continue

                    # Prioritize contact/about/team pages
                    link_lower = full_url.lower()
                    if any(p in link_lower for p in self.PRIORITY_PATTERNS):
                        priority_links.append(full_url)
                    else:
                        other_links.append(full_url)

                except Exception as e:
                    logger.debug(f"Link processing error: {e}")
                    continue

            # Add links to queue: prioritized first, then others
            urls_to_add = priority_links[:3]
            if len(urls_to_add) < 2:
                urls_to_add.extend(other_links[:3])

            added = 0
            for url in urls_to_add:
                # Final check: not visited and queue not full
                if url not in visited and len(visited) < self.max_pages:
                    queue.append((url, depth + 1))
                    added += 1

            logger.info(f"  + Added {added} URLs to queue (priority={len(priority_links)}, other={len(other_links)})")

        except Exception as e:
            logger.warning(f"Traversal layer error on {source_url}: {e}")
            # CRITICAL: Do NOT re-raise! Continue to next page
