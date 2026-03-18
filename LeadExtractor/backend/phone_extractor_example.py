"""
PHONE EXTRACTOR v1.0 — Примеры Использования

Демонстрирует 4 способа использования phone_extractor:
1. Полный pipeline на одной странице
2. Использование отдельных stages
3. Интеграция в FastAPI
4. Использование в BFS crawl
"""

import asyncio
import logging
from crawl4ai import AsyncWebCrawler
from backend.phone_extractor import PhoneExtractor, extract_phones_from_crawl_result

# Настроить логирование для видимости что происходит
logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s - %(name)s - %(message)s'
)

logger = logging.getLogger(__name__)


# ============================================================================
# ПРИМЕР 1: Полный Pipeline на одной странице
# ============================================================================

async def example_1_full_pipeline():
    """
    Самый простой способ: pass CrawlResult к extract_phones()
    и получить все номера в одной функции.
    """
    logger.info("\n" + "="*60)
    logger.info("ПРИМЕР 1: Полный Pipeline")
    logger.info("="*60)

    # Инициализировать краулер
    crawler = AsyncWebCrawler()

    # Примеры сайтов для тестирования
    test_urls = [
        "https://1cca.ru",
        "https://1cca.ru/contacts",
    ]

    for url in test_urls:
        try:
            # Fetch страница
            logger.info(f"\nFetching: {url}")
            result = await crawler.arun(url)

            if not result:
                logger.warning(f"Failed to fetch {url}")
                continue

            # Convenience функция - все 4 stages вместе
            phones = extract_phones_from_crawl_result(result)

            # Вывести результаты
            logger.info(f"Found {len(phones)} phones on {url}")
            for phone_info in phones:
                logger.info(
                    f"  ✅ {phone_info['phone']}\n"
                    f"     Source: {phone_info['source_page']}\n"
                    f"     Type: {phone_info['raw_source']}"
                )

        except Exception as e:
            logger.error(f"Error processing {url}: {e}")

    await crawler.close()


# ============================================================================
# ПРИМЕР 2: Использование отдельных Stages
# ============================================================================

async def example_2_individual_stages():
    """
    Использовать каждый stage отдельно.
    Полезно когда нужен контроль над процессом.
    """
    logger.info("\n" + "="*60)
    logger.info("ПРИМЕР 2: Отдельные Stages")
    logger.info("="*60)

    crawler = AsyncWebCrawler()
    extractor = PhoneExtractor()

    url = "https://1cca.ru"

    try:
        result = await crawler.arun(url)

        if not result:
            logger.error(f"Failed to fetch {url}")
            return

        html = getattr(result, 'html', '') or ''
        cleaned_html = getattr(result, 'cleaned_html', '') or ''
        markdown = getattr(result, 'markdown', '') or ''
        page_url = url

        combined_text = f"{markdown}\n{cleaned_html}"

        # STAGE 1: Tel: ссылки (никогда не фильтруются)
        logger.info("\n[STAGE 1] Extracting tel: links...")
        tel_phones = extractor.extract_tel_links(html, page_url)
        logger.info(f"Found {len(tel_phones)} tel links")
        for p in tel_phones:
            logger.info(f"  ✅ {p['phone']}")

        # STAGE 2: Fragmented merge (BeautifulSoup)
        logger.info("\n[STAGE 2] Merging fragmented phones...")
        fragmented = extractor.extract_fragmented_phones(html, page_url)
        logger.info(f"Found {len(fragmented)} fragmented phones")
        for p in fragmented:
            logger.info(f"  ✅ {p['phone']}")

        # STAGE 3: Text patterns (Russian keywords)
        logger.info("\n[STAGE 3] Extracting from text patterns...")
        text_patterns = extractor.extract_from_text_patterns(combined_text, page_url)
        logger.info(f"Found {len(text_patterns)} text pattern phones")
        for p in text_patterns:
            logger.info(f"  ✅ {p['phone']}")

        # STAGE 4: Normalization (уже включена в stages, но можно вызвать отдельно)
        logger.info("\n[STAGE 4] Normalization examples...")
        raw_phones = [
            "+7-495-123-45-67",
            "8 (383) 262-16-42",
            "(495) 123-45-67",
        ]
        for raw in raw_phones:
            normalized = extractor.normalize_phone(raw)
            logger.info(f"  {raw} → {normalized}")

        # Итого
        total = len(tel_phones) + len(fragmented) + len(text_patterns)
        logger.info(f"\n📊 TOTAL: {total} phones from {page_url}")

    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)

    await crawler.close()


# ============================================================================
# ПРИМЕР 3: Использование в FastAPI Endpoint
# ============================================================================

async def example_3_fastapi_integration():
    """
    Интеграция в FastAPI endpoint для REST API.
    """
    logger.info("\n" + "="*60)
    logger.info("ПРИМЕР 3: FastAPI Integration Code")
    logger.info("="*60)

    # Вот как использовать в FastAPI:
    example_code = """
    from fastapi import FastAPI
    from pydantic import BaseModel
    from backend.phone_extractor import extract_phones_from_crawl_result
    from crawl4ai import AsyncWebCrawler

    app = FastAPI()

    class ExtractRequest(BaseModel):
        url: str

    class PhoneResult(BaseModel):
        phone: str
        source_page: str
        raw_source: str  # tel_link, fragmented, contact_pattern

    @app.post("/api/extract-phones", response_model=list[PhoneResult])
    async def extract_phones(request: ExtractRequest):
        '''
        Endpoint для extraction телефонов с сайта

        Example request:
            POST /api/extract-phones
            {"url": "https://1cca.ru"}

        Example response:
            [
              {
                "phone": "+7 (495) 123-45-67",
                "source_page": "https://1cca.ru",
                "raw_source": "tel_link"
              },
              {
                "phone": "+7 (812) 250-62-10",
                "source_page": "https://1cca.ru/contacts",
                "raw_source": "contact_pattern"
              }
            ]
        '''
        crawler = AsyncWebCrawler()
        try:
            result = await crawler.arun(request.url)
            phones = extract_phones_from_crawl_result(result)
            return phones
        finally:
            await crawler.close()
    """

    logger.info(example_code)


# ============================================================================
# ПРИМЕР 4: Использование в BFS Crawl (Crawl4AIClient)
# ============================================================================

async def example_4_bfs_integration():
    """
    Интеграция в BFS crawl для обхода множества страниц.
    """
    logger.info("\n" + "="*60)
    logger.info("ПРИМЕР 4: BFS Crawl Integration Code")
    logger.info("="*60)

    example_code = """
    # В backend/crawl4ai_client.py

    from backend.phone_extractor import extract_phones_from_crawl_result

    class Crawl4AIClient:
        async def extract(self, domain_url: str):
            '''Основная функция для BFS extraction'''
            from collections import deque

            crawler = AsyncWebCrawler()
            queue = deque([(domain_url, 0)])
            visited = set()
            all_phones = []

            while queue and len(visited) < self.max_pages:
                current_url, depth = queue.popleft()

                if current_url in visited or depth > self.max_depth:
                    continue

                visited.add(current_url)

                # Fetch страница
                result = await self._fetch_page(crawler, current_url)
                if not result:
                    continue

                # ⭐ Использовать новый phone_extractor вместо старой _extract_contacts
                phones = extract_phones_from_crawl_result(result)
                all_phones.extend(phones)

                logger.info(f"Page {len(visited)}: {current_url}")
                logger.info(f"  Found {len(phones)} phones")

                # Продолжить BFS traversal
                self._traverse_links(result, current_url, domain_url, depth, visited, queue)

            await crawler.close()

            return {
                "domain": domain_url,
                "pages_crawled": len(visited),
                "phones": all_phones
            }
    """

    logger.info(example_code)


# ============================================================================
# ПРИМЕР 5: Тестирование Отдельных Функций
# ============================================================================

def example_5_unit_tests():
    """
    Unit tests для отдельных функций.
    """
    logger.info("\n" + "="*60)
    logger.info("ПРИМЕР 5: Unit Tests")
    logger.info("="*60)

    extractor = PhoneExtractor()

    # Test 1: Tel link with URL encoding
    logger.info("\n[TEST 1] Tel link with URL encoding")
    html = 'href="tel:%2B7%20(495)%20123-45-67"'
    phones = extractor.extract_tel_links(html, "https://test.ru")
    expected = "+7 (495) 123-45-67"
    assert len(phones) > 0, "Should find tel link"
    logger.info(f"  ✅ Input: {html}")
    logger.info(f"  ✅ Output: {phones[0]['phone']}")
    logger.info(f"  ✅ Expected: {expected}")

    # Test 2: Sanity filter
    logger.info("\n[TEST 2] Sanity filter")
    test_cases = [
        ("+7 (495) 123-45-67", True, "Valid phone"),
        ("123", False, "Too short"),
        ("1234567890123456", False, "Too long"),
        ("3.14159", False, "Float"),
        ("01.01.2024", False, "Date"),
    ]
    for candidate, expected_result, description in test_cases:
        result = extractor._is_sane_phone_candidate(candidate)
        status = "✅" if result == expected_result else "❌"
        logger.info(f"  {status} {description}: {candidate} → {result}")

    # Test 3: Structural filter
    logger.info("\n[TEST 3] Structural filter")
    test_cases = [
        ("+7 (495) 123-45-67", True, "Valid with separators"),
        ("1234567890", False, "Pure digits"),
        ("1997-2026", False, "Year range"),
        ("8(383)262-16-42", True, "Valid with parentheses"),
    ]
    for candidate, expected_result, description in test_cases:
        result = extractor._is_structural_phone(candidate)
        status = "✅" if result == expected_result else "❌"
        logger.info(f"  {status} {description}: {candidate} → {result}")

    # Test 4: Normalization
    logger.info("\n[TEST 4] Normalization")
    test_cases = [
        ("+7-495-123-45-67", "+7 (495) 123-45-67"),
        ("8 (383) 262-16-42", "+7 (383) 262-16-42"),
        ("(495) 123-45-67", "+7 (495) 123-45-67"),
    ]
    for raw, expected in test_cases:
        result = extractor.normalize_phone(raw)
        status = "✅" if result == expected else "⚠️"
        logger.info(f"  {status} {raw} → {result}")
        if result != expected:
            logger.info(f"     Expected: {expected}")


# ============================================================================
# MAIN: Запуск всех примеров
# ============================================================================

async def main():
    """Запустить все примеры."""

    # ПРИМЕР 1: Полный pipeline
    try:
        await example_1_full_pipeline()
    except Exception as e:
        logger.error(f"Example 1 failed: {e}")

    # ПРИМЕР 2: Отдельные stages
    try:
        await example_2_individual_stages()
    except Exception as e:
        logger.error(f"Example 2 failed: {e}")

    # ПРИМЕР 3: FastAPI код
    await example_3_fastapi_integration()

    # ПРИМЕР 4: BFS код
    await example_4_bfs_integration()

    # ПРИМЕР 5: Unit tests
    example_5_unit_tests()

    logger.info("\n" + "="*60)
    logger.info("✅ ВСЕ ПРИМЕРЫ ЗАВЕРШЕНЫ")
    logger.info("="*60)


if __name__ == "__main__":
    # Запустить примеры
    asyncio.run(main())
