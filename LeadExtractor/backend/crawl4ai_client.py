"""
Crawl4AI 0.8.x BFS traversal for contact extraction.
ARCHITECTURE: 3 independent layers (FETCH → EXTRACTION → TRAVERSAL)
Each layer is protected from errors in other layers.
"""

import asyncio
import re
import logging
from typing import Dict, List, Set, Optional
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

    async def extract(self, domain_url: str) -> Dict:
        """
        BFS traversal with 3-layer architecture.
        Returns: {"emails": [...], "phones": [...], "sources": [...]}
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
                    result = await self._fetch_page(crawler, current_url)
                    if result is None:
                        continue

                    sources.add(current_url)

                    # ============================================
                    # LAYER 2: EXTRACTION (INDEPENDENT)
                    # ============================================
                    emails_on_page, phones_on_page = self._extract_contacts(result, current_url, all_emails, all_phones)

                    if emails_on_page or phones_on_page:
                        logger.info(f"  📧 {len(emails_on_page)} emails, 📞 {len(phones_on_page)} phones")

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
        }

        logger.info(f"\n{'='*60}")
        logger.info(f"✓ Crawled {len(visited)} pages")
        logger.info(f"✓ Found {len(result['emails'])} emails, {len(result['phones'])} phones")
        logger.info(f"{'='*60}\n")

        return result

    async def _fetch_page(self, crawler, url: str):
        """
        LAYER 1: FETCH - Get page from Crawl4AI
        Returns CrawlResult or None if failed

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
                logger.warning(f"  ✗ Failed to crawl")
                return None

            logger.info(f"  ✓ Success")
            return result

        except asyncio.TimeoutError:
            logger.warning(f"  ✗ Timeout")
            return None
        except Exception as e:
            logger.error(f"  ✗ Fetch error: {e}")
            return None

    def _extract_contacts(self, result, source_url: str, all_emails: Dict, all_phones: Dict) -> tuple:
        """
        LAYER 2: EXTRACTION - Extract emails and phones
        Returns (emails_set, phones_set)

        CRITICAL: This layer is INDEPENDENT from traversal
        If it fails, traversal still runs

        Uses:
        - result.html (primary source)
        - result.cleaned_html (fallback)
        - result.extracted_content (fallback)
        """
        emails_on_page = set()
        phones_on_page = set()

        try:
            # Prepare content sources
            html = result.html or ""
            fallback = result.cleaned_html or result.extracted_content or ""
            combined = f"{html} {fallback}"

            # Extract emails from all sources
            try:
                for email in re.findall(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', combined):
                    email_clean = email.lower().strip()
                    if email_clean not in emails_on_page:
                        all_emails[email_clean] = source_url
                        emails_on_page.add(email_clean)

                # Also extract from mailto: links
                for match in re.findall(r'href=["\']?mailto:([^"\'>\s]+)', html):
                    if "@" in match:
                        email_clean = match.lower().strip()
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

                # Also extract from tel: links
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
