"""
Optimized Crawl4AI client for contact extraction.
Uses full power of Crawl4AI: Deep Crawling + URL Seeding + CSS Extraction.
"""

import asyncio
import re
import logging
from typing import Dict, List, Tuple, Set, Optional
from urllib.parse import urljoin, urlparse
import json

logger = logging.getLogger(__name__)

# Try to import advanced Crawl4AI features
try:
    from crawl4ai.deep_crawling import BFSDeepCrawlStrategy
    from crawl4ai.deep_crawling.filters import URLPatternFilter, FilterChain
    DEEP_CRAWL_AVAILABLE = True
except ImportError:
    DEEP_CRAWL_AVAILABLE = False
    logger.warning("Deep crawling not available, using fallback strategy")

try:
    from crawl4ai import AsyncUrlSeeder, SeedingConfig
    URL_SEEDING_AVAILABLE = True
except ImportError:
    URL_SEEDING_AVAILABLE = False


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
        Advanced crawl with Deep Crawling strategy.
        Automatically follows links to find contact pages.
        """
        try:
            from crawl4ai import AsyncWebCrawler, CrawlerRunConfig
        except ImportError:
            logger.error("Crawl4AI not installed")
            return {'emails': [], 'phones': [], 'sources': []}

        # Normalize URL
        if not domain_url.startswith(('http://', 'https://')):
            domain_url = f'https://{domain_url}'

        domain = urlparse(domain_url).netloc
        logger.info(f"Starting deep crawl for domain: {domain_url}")

        results = {'emails': [], 'phones': [], 'sources': []}

        try:
            async with AsyncWebCrawler() as crawler:
                # ============ STEP 1: DEEP CRAWL (самое мощное улучшение) ============
                if DEEP_CRAWL_AVAILABLE:
                    logger.info("Using Deep Crawling Strategy")

                    # Фильтр на контактные страницы
                    contact_filter = FilterChain([
                        URLPatternFilter(patterns=[
                            "*kontakt*", "*contact*", "*about*", "*team*",
                            "*компани*", "*о-нас*", "*connected*", "*связь*",
                            "*email*", "*phone*", "*support*", "*sales*"
                        ])
                    ])

                    # Deep Crawl конфиг
                    deep_config = CrawlerRunConfig(
                        deep_crawl_strategy=BFSDeepCrawlStrategy(
                            max_depth=2,           # homepage + 2 уровня
                            max_pages=self.max_pages * 3,  # больше страниц
                            filter_chain=contact_filter
                        ),
                        wait_until="networkidle",
                        page_timeout=self.timeout,
                        word_count_threshold=5,
                        remove_overlay_elements=True,
                        process_iframes=True,
                        scan_full_page=True,
                    )

                    # Запускаем deep crawl - возвращает список результатов
                    deep_results = await crawler.arun(url=domain_url, config=deep_config)

                    # Deep crawl возвращает список страниц, обработаем каждую
                    if isinstance(deep_results, list):
                        for page_result in deep_results[:self.max_pages]:
                            if page_result.success:
                                emails, phones = await self._extract_from_result(
                                    page_result, page_result.url
                                )
                                results['emails'].extend(emails)
                                results['phones'].extend(phones)
                                if emails or phones:
                                    results['sources'].append(page_result.url)
                    else:
                        # Если single result
                        if deep_results.success:
                            emails, phones = await self._extract_from_result(
                                deep_results, domain_url
                            )
                            results['emails'].extend(emails)
                            results['phones'].extend(phones)
                            if emails or phones:
                                results['sources'].append(domain_url)
                else:
                    # ============ FALLBACK: Обычный краул если Deep Crawling недоступен ============
                    logger.info("Deep Crawling not available, using standard crawl")

                    config = CrawlerRunConfig(
                        wait_until="networkidle",
                        page_timeout=self.timeout,
                        word_count_threshold=10,
                        scan_full_page=True,
                        wait_for_images=True,
                        remove_overlay_elements=True,
                        process_iframes=True,
                        keep_data_attributes=True,
                    )

                    # Краулим главную
                    result = await crawler.arun(url=domain_url, config=config)
                    if result.success:
                        emails, phones = await self._extract_from_result(result, domain_url)
                        results['emails'].extend(emails)
                        results['phones'].extend(phones)
                        if emails or phones:
                            results['sources'].append(domain_url)

        except Exception as e:
            logger.error(f"Error crawling {domain_url}: {e}", exc_info=True)

        # Clean and deduplicate
        results['emails'] = self._deduplicate_and_validate(results['emails'])[:5]
        results['phones'] = self._deduplicate_and_validate(results['phones'])[:3]
        results['sources'] = list(set(results['sources']))

        logger.info(
            f"Crawl complete for {domain}: "
            f"{len(results['emails'])} emails, "
            f"{len(results['phones'])} phones, "
            f"{len(results['sources'])} sources"
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
