"""
Crawl4AI 0.8.x optimized client for contact extraction.
Uses: AsyncUrlSeeder + Deep Crawling + JsonCssExtraction + arun_many.
"""

import asyncio
import re
import logging
import json
from typing import Dict, List, Tuple, Set, Optional
from urllib.parse import urljoin, urlparse

logger = logging.getLogger(__name__)


class Crawl4AIClient:
    """Advanced crawler using Crawl4AI 0.8.x features."""

    CONTACT_SCHEMA = {
        "name": "ContactInfo",
        "baseSelector": "body",
        "fields": [
            {
                "name": "emails",
                "selector": "a[href^='mailto:'], .email, [data-email], [class*='email']",
                "type": "attribute",
                "attribute": "href"
            },
            {
                "name": "phones",
                "selector": "a[href^='tel:'], .phone, .tel, [data-phone], [class*='phone']",
                "type": "text"
            }
        ]
    }

    def __init__(self, timeout: int = 30, max_pages: int = 15):
        self.timeout = timeout * 1000
        self.max_pages = max_pages

    async def extract(self, domain_url: str) -> Dict:
        """Main method. Returns {emails: [...], phones: [...]} with source_page."""

        from crawl4ai import AsyncWebCrawler, CrawlerRunConfig
        from crawl4ai import AsyncUrlSeeder, SeedingConfig

        try:
            from crawl4ai.extraction_strategy import JsonCssExtractionStrategy
            EXTRACTION_AVAILABLE = True
        except ImportError:
            EXTRACTION_AVAILABLE = False

        if not domain_url.startswith(('http://', 'https://')):
            domain_url = f'https://{domain_url}'

        domain = urlparse(domain_url).netloc
        logger.info(f"Extracting contacts from: {domain_url}")

        all_emails = {}  # {email: source_page}
        all_phones = {}  # {phone: source_page}
        contact_urls = []

        try:
            async with AsyncWebCrawler() as crawler:

                # ===== STEP 1: URL SEEDING (быстрый поиск контактных ссылок) =====
                logger.info("Step 1: URL Seeding")
                seeder = AsyncUrlSeeder()
                seed_config = SeedingConfig(
                    source="sitemap+cc",
                    pattern="*kontakt*|*contact*|*about*|*team*|*связь*|*контакты*|*email*|*phone*|*support*|*sales*",
                    extract_head=True,
                    max_urls=50
                )

                try:
                    seed_urls = await seeder.urls(domain_url, seed_config)
                    contact_urls = [u["url"] for u in seed_urls if u.get("url")]
                    logger.info(f"Found {len(contact_urls)} contact URLs via seeding")
                except Exception as e:
                    logger.warning(f"URL Seeding failed: {e}")
                    contact_urls = []

                # ===== STEP 2: DEEP CRAWLING (если URL seeding нашел мало) =====
                if len(contact_urls) < 5:
                    logger.info("Step 2: Deep Crawling (fallback)")
                    try:
                        from crawl4ai.deep_crawling import BFSDeepCrawlStrategy
                        from crawl4ai.deep_crawling.filters import URLPatternFilter, FilterChain

                        contact_filter = FilterChain([
                            URLPatternFilter(patterns=[
                                "*kontakt*", "*contact*", "*about*", "*team*",
                                "*компани*", "*о-нас*", "*связь*", "*контакты*",
                                "*email*", "*phone*", "*support*", "*sales*"
                            ])
                        ])

                        deep_config = CrawlerRunConfig(
                            deep_crawl_strategy=BFSDeepCrawlStrategy(
                                max_depth=2,
                                max_pages=self.max_pages,
                                filter_chain=contact_filter
                            ),
                            wait_until="networkidle",
                            page_timeout=self.timeout,
                            word_count_threshold=5,
                            scan_full_page=True,
                            remove_overlay_elements=True,
                            process_iframes=True,
                            keep_data_attributes=True,
                            score_links=True,
                        )

                        deep_results = await crawler.arun(url=domain_url, config=deep_config)

                        if isinstance(deep_results, list):
                            contact_urls.extend([r.url for r in deep_results if hasattr(r, 'url')])
                        else:
                            if hasattr(deep_results, 'url'):
                                contact_urls.append(deep_results.url)

                        logger.info(f"Deep crawling found {len(contact_urls)} URLs total")
                    except Exception as e:
                        logger.warning(f"Deep crawling failed: {e}")
                        contact_urls = [domain_url]

                # ===== STEP 3: EXTRACT CONTACTS from all URLs =====
                if not contact_urls:
                    contact_urls = [domain_url]

                contact_urls = contact_urls[:self.max_pages]
                logger.info(f"Processing {len(contact_urls)} URLs")

                # Конфиг для извлечения
                extract_config = CrawlerRunConfig(
                    wait_until="networkidle",
                    page_timeout=self.timeout,
                    word_count_threshold=5,
                    scan_full_page=True,
                    remove_overlay_elements=True,
                    process_iframes=True,
                    keep_data_attributes=True,
                    c4a_script="""
                    WAIT `#menu, .hamburger, [class*='nav']` 2
                    IF (EXISTS `a:contains("Контакты")`) THEN CLICK `a:contains("Контакты")`
                    IF (EXISTS `a:contains("Contact")`) THEN CLICK `a:contains("Contact")`
                    WAIT `#contacts, .contact-block, [class*='contact']` 2
                    """
                )

                # Добавляем стратегию извлечения если доступна
                if EXTRACTION_AVAILABLE:
                    extract_config.extraction_strategy = JsonCssExtractionStrategy(
                        schema=self.CONTACT_SCHEMA
                    )

                # ===== STEP 4: arun_many + streaming обработка =====
                results = await crawler.arun_many(contact_urls, config=extract_config)

                for result in results:
                    if not result.success:
                        continue

                    source_page = result.url

                    # Способ 1: JsonCssExtraction если доступна
                    if EXTRACTION_AVAILABLE and result.extracted_content:
                        try:
                            data = json.loads(result.extracted_content)

                            for email in data.get("emails", []):
                                clean_email = email.replace("mailto:", "").strip()
                                if clean_email and "@" in clean_email:
                                    all_emails[clean_email] = source_page

                            for phone in data.get("phones", []):
                                if phone and len(re.sub(r'\D', '', phone)) >= 7:
                                    all_phones[phone] = source_page
                        except (json.JSONDecodeError, TypeError):
                            pass

                    # Способ 2: Regex fallback (всегда используй параллельно)
                    html = result.html or ""
                    text = result.cleaned_text or ""
                    content = f"{html} {text}"

                    # Email extraction
                    for email in re.findall(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', content):
                        all_emails[email] = source_page

                    for match in re.findall(r'href=["\']?mailto:([^"\'>\s]+)', content):
                        if "@" in match:
                            all_emails[match] = source_page

                    # Phone extraction
                    for phone in re.findall(r'\+[\d\s\-()]{10,}', text):
                        if len(re.sub(r'\D', '', phone)) >= 7:
                            all_phones[phone] = source_page

                    for phone in re.findall(r'href=["\']?tel:([^"\'>\s]+)', content):
                        if len(re.sub(r'\D', '', phone)) >= 7:
                            all_phones[phone] = source_page

        except Exception as e:
            logger.error(f"Error: {e}", exc_info=True)

        # Форматируем результат
        result = {
            "emails": [
                {"email": email, "source_page": source}
                for email, source in sorted(all_emails.items())
            ][:10],
            "phones": [
                {"phone": phone, "source_page": source}
                for phone, source in sorted(all_phones.items())
            ][:10],
        }

        logger.info(f"Extracted {len(result['emails'])} emails, {len(result['phones'])} phones")
        return result
