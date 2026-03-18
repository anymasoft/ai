import asyncio
from typing import Dict, List, Any
from urllib.parse import urljoin, urlparse
import logging

logger = logging.getLogger(__name__)

class Crawler:
    def __init__(self, timeout: int = 15):
        self.timeout = timeout
        self.max_pages = 5

    async def crawl(self, url: str) -> Dict[str, Any]:
        """
        Основной метод для краулинга сайта.
        Возвращает контакты и информацию об источнике.
        """
        try:
            # Импортируем здесь, чтобы избежать проблем с инициализацией
            from crawl4ai import AsyncWebCrawler

            results = {
                'emails': [],
                'phones': [],
                'sources': []
            }

            # Нормализуем URL
            if not url.startswith(('http://', 'https://')):
                url = f'https://{url}'

            domain = urlparse(url).netloc

            async with AsyncWebCrawler() as crawler:
                # 1. Главная страница
                pages_to_visit = [url]
                visited = set()

                while pages_to_visit and len(visited) < self.max_pages:
                    current_url = pages_to_visit.pop(0)

                    if current_url in visited:
                        continue

                    visited.add(current_url)

                    try:
                        result = await crawler.arun(
                            url=current_url,
                            timeout=self.timeout,
                            word_count_threshold=10
                        )

                        if result.success:
                            from extractors import extract_contacts

                            emails, phones = extract_contacts(
                                current_url,
                                result.html or "",
                                result.cleaned_text or ""
                            )

                            results['emails'].extend(emails)
                            results['phones'].extend(phones)

                            if emails or phones:
                                results['sources'].append(current_url)

                            # Ищем контактные страницы
                            if len(visited) < self.max_pages:
                                contact_patterns = [
                                    '/contact', '/contacts',
                                    '/about', '/team',
                                    '/company'
                                ]

                                for pattern in contact_patterns:
                                    next_url = urljoin(url, pattern)
                                    if next_url not in visited and next_url.startswith(f'http://{domain}') or next_url.startswith(f'https://{domain}'):
                                        if next_url not in pages_to_visit:
                                            pages_to_visit.append(next_url)

                    except asyncio.TimeoutError:
                        logger.warning(f"Timeout при краулинге {current_url}")
                    except Exception as e:
                        logger.error(f"Ошибка при краулинге {current_url}: {e}")

                # Очистить дубликаты
                results['emails'] = list(set(results['emails']))
                results['phones'] = list(set(results['phones']))
                results['sources'] = list(set(results['sources']))

                return results

        except ImportError:
            logger.error("Crawl4AI не установлен")
            return {
                'emails': [],
                'phones': [],
                'sources': []
            }
        except Exception as e:
            logger.error(f"Ошибка при краулинге {url}: {e}")
            return {
                'emails': [],
                'phones': [],
                'sources': []
            }
