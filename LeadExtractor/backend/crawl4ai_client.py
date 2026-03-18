"""
Crawl4AI 0.8.x BFS traversal for contact extraction.
Uses explicit multi-page BFS via result.links.
"""

import asyncio
import re
import logging
from typing import Dict, List, Set, Optional
from urllib.parse import urljoin, urlparse
from collections import deque

logger = logging.getLogger(__name__)


class Crawl4AIClient:
    """Multi-page BFS crawler using Crawl4AI result.links."""

    def __init__(self, timeout: int = 30, max_pages: int = 5, max_depth: int = 2):
        self.timeout = timeout
        self.max_pages = max_pages
        self.max_depth = max_depth
        self.PRIORITY_PATTERNS = [
            'contact', 'about', 'team', 'company', 'support',
            'контакты', 'о-нас', 'команда', 'компани', 'служба'
        ]

    async def extract(self, domain_url: str) -> Dict:
        """BFS traversal. Returns {emails: [...], phones: [...]} with source_page."""

        from crawl4ai import AsyncWebCrawler, CrawlerRunConfig

        if not domain_url.startswith(('http://', 'https://')):
            domain_url = f'https://{domain_url}'

        domain = urlparse(domain_url).netloc
        logger.info(f"\n{'='*60}")
        logger.info(f"Starting BFS traversal: {domain_url}")
        logger.info(f"{'='*60}")

        all_emails = {}
        all_phones = {}
        visited = set()

        queue = deque([(domain_url, 0)])

        try:
            async with AsyncWebCrawler() as crawler:

                while queue and len(visited) < self.max_pages:

                    current_url, depth = queue.popleft()

                    if current_url in visited:
                        continue

                    if depth > self.max_depth:
                        continue

                    visited.add(current_url)

                    # Логирование
                    short_url = current_url.replace(f'https://{domain}', '')[:50]
                    logger.info(f"\n[Page {len(visited)}/{self.max_pages}] Depth {depth} → {short_url}")

                    try:
                        # Fetch + render
                        config = CrawlerRunConfig(
                            wait_until="networkidle",
                            page_timeout=self.timeout * 1000,
                            word_count_threshold=5,
                            scan_full_page=True,
                            remove_overlay_elements=True,
                            process_iframes=True,
                        )

                        result = await asyncio.wait_for(
                            crawler.arun(url=current_url, config=config),
                            timeout=self.timeout + 5
                        )

                        if not result.success:
                            logger.warning(f"  ✗ Failed")
                            continue

                        logger.info(f"  ✓ Success")

                        # Extract contacts
                        html = result.html or ""
                        text = result.cleaned_text or ""
                        content = f"{html} {text}"

                        emails_on_page = set()
                        for email in re.findall(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', content):
                            all_emails[email] = current_url
                            emails_on_page.add(email)

                        for match in re.findall(r'href=["\']?mailto:([^"\'>\s]+)', content):
                            if "@" in match:
                                all_emails[match] = current_url
                                emails_on_page.add(match)

                        phones_on_page = set()
                        for phone in re.findall(r'\+[\d\s\-()]{10,}', text):
                            if len(re.sub(r'\D', '', phone)) >= 7:
                                all_phones[phone] = current_url
                                phones_on_page.add(phone)

                        for phone in re.findall(r'href=["\']?tel:([^"\'>\s]+)', content):
                            if len(re.sub(r'\D', '', phone)) >= 7:
                                all_phones[phone] = current_url
                                phones_on_page.add(phone)

                        if emails_on_page or phones_on_page:
                            logger.info(f"  📧 {len(emails_on_page)} emails, 📞 {len(phones_on_page)} phones")

                        # Extract links
                        links = result.links.get("internal", []) if result.links else []
                        logger.info(f"  Found {len(links)} links")

                        priority_links = []
                        other_links = []

                        for link in links:
                            if not link:
                                continue

                            try:
                                clean_link = link.split('#')[0].split('?')[0]
                                full_url = urljoin(current_url, clean_link)
                                link_domain = urlparse(full_url).netloc

                                if link_domain != domain or full_url in visited:
                                    continue

                                link_lower = full_url.lower()
                                if any(p in link_lower for p in self.PRIORITY_PATTERNS):
                                    priority_links.append(full_url)
                                else:
                                    other_links.append(full_url)

                            except Exception:
                                continue

                        urls_to_add = priority_links[:3]
                        if len(urls_to_add) < 2:
                            urls_to_add.extend(other_links[:3])

                        added = 0
                        for url in urls_to_add:
                            if url not in visited and len(visited) < self.max_pages:
                                queue.append((url, depth + 1))
                                added += 1

                        logger.info(f"  + Added {added} URLs to queue")

                    except asyncio.TimeoutError:
                        logger.warning(f"  ✗ Timeout")
                    except Exception as e:
                        logger.error(f"  ✗ Error: {e}")

        except Exception as e:
            logger.error(f"Fatal: {e}", exc_info=True)

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

        logger.info(f"\n{'='*60}")
        logger.info(f"✓ Crawled {len(visited)} pages")
        logger.info(f"✓ Found {len(result['emails'])} emails, {len(result['phones'])} phones")
        logger.info(f"{'='*60}\n")

        return result
