from crawl4ai import AsyncWebCrawler
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse

RELEVANT_PATHS = ['contact', 'contacts', 'about', 'team', 'about-us', 'get-in-touch']
MAX_PAGES = 5

class Crawl4AIClient:
    def __init__(self, timeout: int = 15, max_pages: int = MAX_PAGES):
        self.timeout = timeout
        self.max_pages = max_pages

    async def crawl_domain(self, domain: str) -> dict:
        base_url = f"https://{domain}"
        visited = set()
        pages_content = []
        all_links = []

        try:
            async with AsyncWebCrawler(verbose=False) as crawler:
                result = await crawler.arun(url=base_url, timeout=self.timeout)
                if result.success:
                    pages_content.append({'url': base_url, 'html': result.html, 'text': result.markdown or ''})
                    visited.add(base_url)
                    links = self._extract_links(result.html, base_url)
                    all_links.extend(links)
                    relevant_links = [l for l in links if any(p in l.lower() for p in RELEVANT_PATHS)]
                    for link in relevant_links[:self.max_pages - 1]:
                        if link not in visited:
                            try:
                                page_result = await crawler.arun(url=link, timeout=self.timeout)
                                if page_result.success:
                                    pages_content.append({'url': link, 'html': page_result.html, 'text': page_result.markdown or ''})
                                    visited.add(link)
                                    if len(pages_content) >= self.max_pages:
                                        break
                            except Exception:
                                continue
        except Exception as e:
            print(f"Error crawling {domain}: {e}")

        return {'pages': pages_content, 'links': list(set(all_links))}

    def _extract_links(self, html: str, base_url: str) -> list[str]:
        try:
            soup = BeautifulSoup(html, 'lxml')
            links = []
            for tag in soup.find_all('a', href=True):
                href = tag['href']
                if href.startswith(('#', 'javascript:', 'mailto:', 'tel:')):
                    continue
                full_url = urljoin(base_url, href)
                parsed = urlparse(full_url)
                if parsed.netloc == urlparse(base_url).netloc:
                    links.append(full_url)
            return list(set(links))
        except Exception:
            return []
