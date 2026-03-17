from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse

RELEVANT_PATHS = ['contact', 'contacts', 'about', 'team', 'about-us', 'get-in-touch']

def is_relevant_link(link: str, base_domain: str) -> bool:
    parsed = urlparse(link)
    path = parsed.path.lower()
    if parsed.netloc and parsed.netloc != base_domain:
        return False
    for keyword in RELEVANT_PATHS:
        if keyword in path:
            return True
    return False

def should_crawl(url: str, base_domain: str, visited: set) -> bool:
    if url in visited:
        return False
    parsed = urlparse(url)
    if parsed.netloc and parsed.netloc != base_domain:
        return False
    return True
