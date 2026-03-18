#!/usr/bin/env python3
"""
Test script for new BFS-based crawler.
Tests email/phone extraction and BFS traversal.
"""

import asyncio
import logging
from crawl4ai_client import Crawl4AIClient

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def test_crawler():
    """Test crawler with manual BFS."""

    # Test domains with known contact info
    test_domains = [
        "example.com",      # Simple test
        "github.com",       # Has contact page
        "python.org",       # Large site with multiple pages
    ]

    client = Crawl4AIClient(timeout=30, max_pages=10, max_depth=2)

    for domain in test_domains:
        logger.info(f"\n{'='*60}")
        logger.info(f"Testing: {domain}")
        logger.info(f"{'='*60}")

        try:
            result = await client.extract(domain)

            logger.info(f"\n✓ Crawl completed")
            logger.info(f"  Emails found: {len(result['emails'])}")
            for email_obj in result['emails'][:5]:
                logger.info(f"    - {email_obj['email']} (from {email_obj['source_page']})")

            logger.info(f"  Phones found: {len(result['phones'])}")
            for phone_obj in result['phones'][:5]:
                logger.info(f"    - {phone_obj['phone']} (from {phone_obj['source_page']})")

            logger.info(f"  Pages crawled: {len(result['sources'])}")

            logger.info(f"  Status per site:")
            success_count = sum(1 for s in result['status_per_site'].values() if s == 'success')
            logger.info(f"    - Success: {success_count}")
            logger.info(f"    - Fallback: {sum(1 for s in result['status_per_site'].values() if s == 'fallback_success')}")
            logger.info(f"    - Failed: {sum(1 for s in result['status_per_site'].values() if s in ['fetch_failed', 'blocked'])}")

        except Exception as e:
            logger.error(f"✗ Error: {e}", exc_info=True)


if __name__ == "__main__":
    asyncio.run(test_crawler())
