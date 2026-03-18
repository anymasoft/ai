"""
Optimized Crawl4AI client for contact extraction.
Uses full power of Crawl4AI: AsyncWebCrawler, BrowserConfig, CrawlerRunConfig.
"""

import asyncio
import re
import logging
from typing import Dict, List, Tuple, Set, Optional
from urllib.parse import urljoin, urlparse
import json

logger = logging.getLogger(__name__)


class Crawl4AIClient:
    """
    Advanced web crawler using Crawl4AI with optimized contact extraction.

    Features:
    - Smart browser configuration for JavaScript rendering
    - Full page scanning with overlay removal
    - Multiple data source extraction (HTML, cleaned HTML, markdown)
    - Smart link discovery for contact pages
    - Parallel page crawling with arun_many
    - Robust email and phone extraction
    """

    # Common contact page patterns (multiple languages)
    CONTACT_PATTERNS = [
        'contact', 'contacts', 'about', 'team', 'company',
        'kontakt', 'kontakty', 'o-nas', 'о-нас', 'связь',
        'info', 'get-in-touch', 'reach-us', 'sales',
        'support', 'help', 'customer-service', 'callback',
        'форма-обратной-связи', 'обратная-связь', 'контакты'
    ]

    def __init__(self, timeout: int = 30, max_pages: int = 5):
        """
        Initialize crawler.

        Args:
            timeout: Page timeout in seconds
            max_pages: Maximum pages to crawl per domain
        """
        self.timeout = timeout * 1000  # Convert to ms
        self.max_pages = max_pages

    async def crawl_domain(self, domain_url: str) -> Dict[str, List]:
        """
        Main entry point: crawl domain and extract all contacts.

        Pipeline:
        1. Normalize URL
        2. Crawl homepage with full configuration
        3. Extract and analyze links
        4. Select contact pages (up to max_pages-1)
        5. Crawl all pages in parallel with arun_many
        6. Extract emails and phones from all pages
        7. Aggregate and deduplicate results

        Returns:
            {
                'emails': [...],
                'phones': [...],
                'sources': [...]  # URLs where contacts were found
            }
        """
        try:
            from crawl4ai import AsyncWebCrawler, CrawlerRunConfig
        except ImportError:
            logger.error("Crawl4AI not installed")
            return {
                'emails': [],
                'phones': [],
                'sources': []
            }

        # Normalize URL
        if not domain_url.startswith(('http://', 'https://')):
            domain_url = f'https://{domain_url}'

        domain = urlparse(domain_url).netloc
        logger.info(f"Starting crawl for domain: {domain_url}")

        results = {
            'emails': [],
            'phones': [],
            'sources': []
        }

        try:
            # Define contact-related CSS selectors
            contact_selectors = [
                "[class*='contact']",
                "[class*='email']",
                "[class*='phone']",
                "[class*='telephone']",
                "footer [class*='info']",
                ".team-member",
                "[data-email]",
                "[data-phone]",
                ".contact-info",
                ".contact-details",
                "[id*='contact']",
                "[id*='footer']",
            ]

            # Configure crawler run with full content extraction
            crawler_config = CrawlerRunConfig(
                wait_until="networkidle",           # Wait for network idle
                page_timeout=self.timeout,
                word_count_threshold=10,
                # ✅ Content extraction improvements
                scan_full_page=True,                # Scroll and load lazy content
                wait_for_images=True,               # Wait for all images to load
                remove_overlay_elements=True,       # Remove popups/modals
                process_iframes=True,               # Extract from iframes
                keep_data_attributes=True,          # Keep data-* attributes
                target_elements=contact_selectors,  # Focus on contact elements
                # ✅ Link handling
                score_links=True,                   # Rank links by relevance
                exclude_external_links=True,        # Only internal links
            )

            # Create AsyncWebCrawler without config (important for Windows!)
            async with AsyncWebCrawler() as crawler:
                # Step 1: Crawl homepage
                homepage_result = await crawler.arun(
                    url=domain_url,
                    config=crawler_config
                )

                pages_to_crawl = [domain_url]  # Track pages to crawl
                visited = {domain_url}

                # Step 2: Extract contacts from homepage
                if homepage_result.success:
                    emails, phones = await self._extract_from_result(
                        homepage_result, domain_url
                    )
                    results['emails'].extend(emails)
                    results['phones'].extend(phones)

                    if emails or phones:
                        results['sources'].append(domain_url)

                    # Step 3: Find contact pages from homepage links
                    contact_urls = await self._find_contact_pages(
                        homepage_result, domain, domain_url, visited
                    )
                    pages_to_crawl.extend(contact_urls)

                # Step 4: Limit to max pages
                pages_to_crawl = pages_to_crawl[:self.max_pages]
                logger.info(f"Will crawl {len(pages_to_crawl)} pages: {pages_to_crawl}")

                # Step 5: Crawl remaining pages in parallel with arun_many
                if len(pages_to_crawl) > 1:
                    remaining_pages = pages_to_crawl[1:]

                    # Use arun_many for parallel crawling
                    batch_results = await crawler.arun_many(
                        urls=remaining_pages,
                        config=crawler_config,
                    )

                    # Step 6: Extract from all batch results
                    for page_url, crawl_result in zip(remaining_pages, batch_results):
                        if crawl_result.success:
                            emails, phones = await self._extract_from_result(
                                crawl_result, page_url
                            )
                            results['emails'].extend(emails)
                            results['phones'].extend(phones)

                            if emails or phones:
                                results['sources'].append(page_url)

        except Exception as e:
            logger.error(f"Error crawling {domain_url}: {e}", exc_info=True)

        # Step 7: Clean results
        results['emails'] = self._deduplicate_and_validate(results['emails'])
        results['phones'] = self._deduplicate_and_validate(results['phones'])
        results['sources'] = list(set(results['sources']))

        # Limit results
        results['emails'] = results['emails'][:5]
        results['phones'] = results['phones'][:3]

        logger.info(
            f"Crawl complete for {domain}: "
            f"{len(results['emails'])} emails, "
            f"{len(results['phones'])} phones"
        )

        return results

    async def _extract_from_result(self, result, page_url: str) -> Tuple[List[str], List[str]]:
        """
        Extract emails and phones from crawl result.
        Uses multiple data sources:
        - HTML (for mailto and tel links)
        - Cleaned HTML (for text content)
        - Markdown (for formatted text)
        """
        emails = set()
        phones = set()

        try:
            # Source 1: Extract from HTML (mailto: and tel: links)
            if result.html:
                html_emails = self._extract_emails_from_html(result.html)
                html_phones = self._extract_phones_from_html(result.html)
                emails.update(html_emails)
                phones.update(html_phones)

            # Source 2: Extract from cleaned HTML
            if hasattr(result, 'cleaned_html') and result.cleaned_html:
                cleaned_emails = self._extract_emails_from_text(result.cleaned_html)
                cleaned_phones = self._extract_phones_from_text(result.cleaned_html)
                emails.update(cleaned_emails)
                phones.update(cleaned_phones)

            # Source 3: Extract from markdown
            if hasattr(result, 'markdown') and result.markdown:
                markdown_text = (
                    result.markdown.raw_markdown
                    if hasattr(result.markdown, 'raw_markdown')
                    else str(result.markdown)
                )
                md_emails = self._extract_emails_from_text(markdown_text)
                md_phones = self._extract_phones_from_text(markdown_text)
                emails.update(md_emails)
                phones.update(md_phones)

        except Exception as e:
            logger.warning(f"Error extracting from {page_url}: {e}")

        return list(emails), list(phones)

    async def _find_contact_pages(
        self,
        result,
        domain: str,
        domain_url: str,
        visited: Set[str]
    ) -> List[str]:
        """
        Find contact pages from homepage links.
        Uses result.links["internal"] for smart discovery.
        """
        contact_urls = []

        try:
            # Get internal links
            internal_links = []
            if hasattr(result, 'links') and 'internal' in result.links:
                internal_links = result.links['internal'] or []

            # Also try to extract from HTML if links not available
            if not internal_links and result.html:
                internal_links = self._extract_internal_links(result.html, domain_url)

            # Match contact patterns
            for link in internal_links:
                if not link:
                    continue

                # Normalize link
                try:
                    full_url = urljoin(domain_url, link)
                    parsed = urlparse(full_url)

                    # Check if same domain
                    if parsed.netloc != domain:
                        continue

                    # Skip if already visited
                    if full_url in visited:
                        continue

                    # Check if matches contact pattern
                    link_lower = link.lower()
                    if any(pattern in link_lower for pattern in self.CONTACT_PATTERNS):
                        contact_urls.append(full_url)
                        visited.add(full_url)

                except Exception:
                    continue

            # Remove duplicates
            contact_urls = list(set(contact_urls))
            logger.debug(f"Found {len(contact_urls)} contact pages: {contact_urls}")

        except Exception as e:
            logger.warning(f"Error finding contact pages: {e}")

        return contact_urls[:self.max_pages - 1]  # Limit to remaining slots

    def _extract_emails_from_html(self, html: str) -> List[str]:
        """Extract emails from HTML, including mailto: links."""
        emails = []

        # Pattern 1: mailto: links
        mailto_pattern = r'mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})'
        matches = re.findall(mailto_pattern, html, re.IGNORECASE)
        emails.extend(matches)

        return list(set(emails))

    def _extract_phones_from_html(self, html: str) -> List[str]:
        """Extract phones from HTML, including tel: links."""
        phones = []

        # Pattern 1: tel: links
        tel_pattern = r'tel:([+\d\s\-()]{7,})'
        matches = re.findall(tel_pattern, html, re.IGNORECASE)
        phones.extend([m.strip() for m in matches])

        return list(set(phones))

    def _extract_emails_from_text(self, text: str) -> List[str]:
        """Extract email addresses from text."""
        pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        emails = re.findall(pattern, text)
        return list(set(emails))

    def _extract_phones_from_text(self, text: str) -> List[str]:
        """
        Extract phone numbers from text.
        Handles multiple formats: +1 555 000, (123) 456-7890, +7 8, etc.
        """
        phones = []

        patterns = [
            # International format: +1 234 567 8900, +7 (123) 456-7890
            r'\+[\d\s\-()]{10,}',
            # US format: (123) 456-7890, 123-456-7890
            r'\(\d{1,4}\)\s?[\d\s\-()]{7,}',
            # Simple format: 123-456-7890, 123 456 7890
            r'\d{3}[\s\-.]?\d{3}[\s\-.]?\d{4}',
            # Just digits with separators: longer sequences
            r'\d[\d\s\-()]{10,}',
        ]

        for pattern in patterns:
            matches = re.findall(pattern, text)
            for match in matches:
                # Filter out invalid matches
                if self._is_valid_phone(match):
                    phones.append(match.strip())

        return list(set(phones))

    def _is_valid_phone(self, phone: str) -> bool:
        """Validate phone number (has enough digits, not just words)."""
        digits = re.sub(r'\D', '', phone)
        # Need at least 7 digits for a valid phone
        return len(digits) >= 7

    def _extract_internal_links(self, html: str, base_url: str) -> List[str]:
        """Extract internal links from HTML."""
        links = []

        # Find href attributes
        href_pattern = r'href=["\']([^"\']+)["\']'
        matches = re.findall(href_pattern, html, re.IGNORECASE)

        domain = urlparse(base_url).netloc

        for href in matches:
            try:
                # Skip special URLs
                if href.startswith(('#', 'javascript:', 'mailto:', 'tel:', 'data:')):
                    continue

                # Normalize
                full_url = urljoin(base_url, href)
                parsed = urlparse(full_url)

                if parsed.netloc == domain:
                    links.append(href)

            except Exception:
                continue

        return list(set(links))

    def _deduplicate_and_validate(self, items: List[str]) -> List[str]:
        """Remove duplicates, filter empty/invalid items."""
        seen = set()
        result = []

        for item in items:
            if not item:
                continue

            item = item.strip()
            if not item or item in seen:
                continue

            seen.add(item)
            result.append(item)

        return result
