"""
Crawl4AI 0.8.x with native BFSDeepCrawlStrategy for contact extraction.
ARCHITECTURE: Using Crawl4AI's built-in deep crawling capabilities
- FETCH: AsyncWebCrawler with BFSDeepCrawlStrategy
- EXTRACTION: Regex post-processing + Table extraction
- TRAVERSAL: Built-in BFSDeepCrawlStrategy (no manual implementation)
"""

import asyncio
import re
import logging
import requests
from typing import Dict, List, Optional, Tuple
from urllib.parse import urlparse

logger = logging.getLogger(__name__)


class Crawl4AIClient:
    """
    Contact extraction using Crawl4AI's native BFSDeepCrawlStrategy.
    Leverages Crawl4AI's built-in deep crawling instead of manual BFS implementation.
    """

    def __init__(self, timeout: int = 30, max_pages: int = 5, max_depth: int = 2):
        self.timeout = timeout
        self.max_pages = max_pages
        self.max_depth = max_depth

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
        Extract contacts using Crawl4AI's native BFSDeepCrawlStrategy.
        Returns: {"emails": [...], "phones": [...], "sources": [...], "status_per_site": {...}}
        """

        from crawl4ai import AsyncWebCrawler, CrawlerRunConfig
        from crawl4ai.deep_crawling import BFSDeepCrawlStrategy
        from crawl4ai.deep_crawling.filters import URLPatternFilter, FilterChain

        # Normalize input URL
        if not domain_url.startswith(('http://', 'https://')):
            domain_url = f'https://{domain_url}'

        domain = urlparse(domain_url).netloc

        logger.info(f"\n{'='*60}")
        logger.info(f"Starting BFS traversal: {domain_url}")
        logger.info(f"Max pages: {self.max_pages}, Max depth: {self.max_depth}")
        logger.info(f"{'='*60}")

        # Global storage for results
        all_emails = {}  # {email: source_page}
        all_phones = {}  # {phone: source_page}
        sources = set()
        status_per_site = {}

        try:
            async with AsyncWebCrawler() as crawler:

                # Create filter chain to keep only internal links
                # CRITICAL: Pass filters at init time to avoid tuple.append() bug
                domain_filter = URLPatternFilter(
                    patterns=[f"https?://{re.escape(domain)}.*"],
                    reverse=False  # False = INCLUDE, True = EXCLUDE
                )
                filter_chain = FilterChain(filters=[domain_filter])

                # Create BFSDeepCrawlStrategy with Crawl4AI's native implementation
                deep_crawl_strategy = BFSDeepCrawlStrategy(
                    max_depth=self.max_depth,
                    max_pages=self.max_pages,
                    filter_chain=filter_chain,
                    include_external=False,
                    logger=logger
                )

                # Configure crawler with deep crawl strategy
                config = CrawlerRunConfig(
                    deep_crawl_strategy=deep_crawl_strategy,
                    wait_until="networkidle",
                    page_timeout=self.timeout * 1000,
                    word_count_threshold=5,
                    scan_full_page=True,
                    remove_overlay_elements=True,
                    process_iframes=True,
                    stream=False,  # Use batch mode for simpler processing
                )

                # Use BFSDeepCrawlStrategy's arun to get all results
                batch_results = await deep_crawl_strategy.arun(
                    start_url=domain_url,
                    crawler=crawler,
                    config=config
                )

                # Process all crawled results
                page_count = 0
                for result in batch_results:
                    if not result.success:
                        # Try fallback fetch
                        logger.warning(f"Crawl4AI failed for {result.url}, trying fallback...")
                        fallback_html = self._fallback_fetch(result.url)

                        if fallback_html:
                            # Update result with fallback HTML
                            result.html = fallback_html
                            result.success = True
                            status_per_site[result.url] = "fallback_success"
                            logger.info(f"Fallback succeeded for {result.url}")
                        else:
                            logger.warning(f"Site blocked: {result.url}")
                            status_per_site[result.url] = "blocked"
                            sources.add(result.url)
                            continue
                    else:
                        status_per_site[result.url] = "success"

                    page_count += 1
                    sources.add(result.url)

                    # Log page info
                    short_url = result.url.replace(f'https://{domain}', '')[:50]
                    depth = result.metadata.get('depth', 0) if result.metadata else 0
                    logger.info(f"\n[Page {page_count}/{self.max_pages}] Depth {depth} → {short_url}")

                    # Extract emails and phones from HTML
                    emails_on_page, phones_on_page = self._extract_contacts(
                        result, result.url, all_emails, all_phones
                    )

                    if emails_on_page or phones_on_page:
                        logger.info(f"  Found {len(emails_on_page)} emails, {len(phones_on_page)} phones")

                    # Extract from tables if available
                    if result.tables:
                        logger.info(f"  Found {len(result.tables)} table(s)")
                        for table in result.tables:
                            self._extract_from_table(table, result.url, all_emails, all_phones)

        except Exception as e:
            logger.error(f"Fatal error: {e}", exc_info=True)

        # Build final result
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
        logger.info(f"Crawled {page_count} pages")
        logger.info(f"Found {len(result['emails'])} emails, {len(result['phones'])} phones")
        logger.info(f"{'='*60}\n")

        return result

    def _extract_contacts(
        self,
        result,
        source_url: str,
        all_emails: Dict,
        all_phones: Dict
    ) -> Tuple[set, set]:
        """
        Extract emails and phones from HTML.
        Uses regex patterns on raw HTML.

        Returns: (emails_set, phones_set)
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
            # Get HTML content
            html = result.html or ""
            if not html:
                return emails_on_page, phones_on_page

            # Normalize common obfuscation patterns
            html_normalized = html.replace("[at]", "@").replace("(at)", "@").replace(" at ", "@")

            # Extract emails from standard regex patterns
            try:
                for email in re.findall(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', html_normalized):
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
                        is_garbage = any(re.match(pattern, email_clean.split('@')[0]) for pattern in garbage_patterns)
                        if is_garbage:
                            continue

                        if email_clean not in emails_on_page:
                            all_emails[email_clean] = source_url
                            emails_on_page.add(email_clean)

                # More aggressive extraction on contact pages
                if any(p in source_url.lower() for p in ['contact', 'about', 'team']):
                    for match in re.findall(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}', html_normalized):
                        email_clean = match.lower().strip()
                        is_garbage = any(re.match(pattern, email_clean.split('@')[0]) for pattern in garbage_patterns)
                        if is_garbage:
                            continue

                        if email_clean not in emails_on_page:
                            all_emails[email_clean] = source_url
                            emails_on_page.add(email_clean)

            except Exception as e:
                logger.debug(f"Email extraction error: {e}")

            # Extract phones
            try:
                for phone in re.findall(r'\+[\d\s\-()]{10,}', html):
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
            logger.warning(f"Extraction error on {source_url}: {e}")

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
        Tables are extracted by Crawl4AI with structure: {headers: [...], rows: [...]}
        """
        try:
            rows = table.get("rows", [])

            for row in rows:
                if not isinstance(row, (list, dict)):
                    continue

                # Handle both list and dict row formats
                cells = row if isinstance(row, list) else row.get("cells", [])

                for cell in cells:
                    if not cell:
                        continue

                    cell_text = str(cell).lower()

                    # Extract emails from cell
                    for email in re.findall(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}\b', cell_text):
                        if email not in all_emails:
                            all_emails[email] = source_url

                    # Extract phones from cell
                    for phone in re.findall(r'\+[\d\s\-()]{10,}', str(cell)):
                        digits = len(re.sub(r'\D', '', phone))
                        if digits >= 7 and phone not in all_phones:
                            all_phones[phone] = source_url

        except Exception as e:
            logger.debug(f"Table extraction error: {e}")
