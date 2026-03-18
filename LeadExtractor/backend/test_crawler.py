"""
Test script for Crawl4AIClient.
Run with: python test_crawler.py
"""

import asyncio
import logging
from crawl4ai_client import Crawl4AIClient

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


async def test_single_domain():
    """Test crawling a single domain."""
    logger.info("=" * 60)
    logger.info("TEST: Single domain crawl")
    logger.info("=" * 60)

    client = Crawl4AIClient(timeout=30, max_pages=5)

    # Test with a simple domain
    domain = "example.com"
    logger.info(f"Crawling domain: {domain}")

    try:
        result = await client.crawl_domain(domain)

        logger.info(f"✓ Crawl successful!")
        logger.info(f"  Emails found: {len(result['emails'])}")
        for email in result['emails']:
            logger.info(f"    - {email}")

        logger.info(f"  Phones found: {len(result['phones'])}")
        for phone in result['phones']:
            logger.info(f"    - {phone}")

        logger.info(f"  Sources: {len(result['sources'])}")
        for source in result['sources']:
            logger.info(f"    - {source}")

    except Exception as e:
        logger.error(f"✗ Crawl failed: {e}", exc_info=True)


async def test_multiple_domains():
    """Test crawling multiple domains in parallel."""
    logger.info("=" * 60)
    logger.info("TEST: Multiple domains crawl (parallel)")
    logger.info("=" * 60)

    client = Crawl4AIClient(timeout=30, max_pages=5)

    domains = [
        "example.com",
        "google.com",
        "github.com",
    ]

    logger.info(f"Crawling {len(domains)} domains in parallel...")

    try:
        tasks = [client.crawl_domain(domain) for domain in domains]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        for domain, result in zip(domains, results):
            if isinstance(result, Exception):
                logger.error(f"✗ {domain}: {result}")
                continue

            logger.info(f"✓ {domain}")
            logger.info(f"  Emails: {len(result['emails'])}, Phones: {len(result['phones'])}")

            if result['emails']:
                logger.info(f"  Sample emails: {result['emails'][:2]}")
            if result['phones']:
                logger.info(f"  Sample phones: {result['phones'][:2]}")

    except Exception as e:
        logger.error(f"✗ Batch crawl failed: {e}", exc_info=True)


async def test_with_contact_page():
    """Test crawling a domain with dedicated contact page."""
    logger.info("=" * 60)
    logger.info("TEST: Domain with contact page")
    logger.info("=" * 60)

    client = Crawl4AIClient(timeout=30, max_pages=5)

    # Test with domain that should have contact page
    domain = "github.com"
    logger.info(f"Crawling domain with contact page: {domain}")

    try:
        result = await client.crawl_domain(domain)

        logger.info(f"✓ Crawl successful!")
        logger.info(f"  Total emails: {len(result['emails'])}")
        logger.info(f"  Total phones: {len(result['phones'])}")
        logger.info(f"  Pages crawled: {len(result['sources'])}")

        # Show sources (which pages had contacts)
        if result['sources']:
            logger.info(f"  Pages with contacts:")
            for source in result['sources']:
                logger.info(f"    - {source}")

    except Exception as e:
        logger.error(f"✗ Crawl failed: {e}", exc_info=True)


async def test_email_extraction():
    """Test email extraction from various formats."""
    logger.info("=" * 60)
    logger.info("TEST: Email extraction from HTML")
    logger.info("=" * 60)

    client = Crawl4AIClient()

    test_html = """
    <html>
        <body>
            <a href="mailto:contact@example.com">Contact us</a>
            <p>Email: info@company.org</p>
            <p>Reach us at sales@acme.io or support@acme.io</p>
        </body>
    </html>
    """

    emails = client._extract_emails_from_html(test_html)
    logger.info(f"Emails found in HTML: {emails}")

    emails_text = client._extract_emails_from_text(test_html)
    logger.info(f"Emails found in text: {emails_text}")


async def test_phone_extraction():
    """Test phone extraction from various formats."""
    logger.info("=" * 60)
    logger.info("TEST: Phone extraction from various formats")
    logger.info("=" * 60)

    client = Crawl4AIClient()

    test_text = """
    Call us: +1 555-000-0000
    US: (555) 000-0000
    International: +7 (999) 888-77-66
    Simple: 555-666-7777
    WhatsApp: +44 20 7946 0958
    """

    phones = client._extract_phones_from_text(test_text)
    logger.info(f"Phones found:")
    for phone in phones:
        logger.info(f"  - {phone}")


async def test_phone_validation():
    """Test phone number validation."""
    logger.info("=" * 60)
    logger.info("TEST: Phone validation")
    logger.info("=" * 60)

    client = Crawl4AIClient()

    test_phones = [
        "+1 555-000-0000",      # Valid: 10 digits
        "(555) 000-0000",       # Valid: 10 digits
        "555-666-7777",         # Valid: 10 digits
        "+7 (999) 888-77-66",   # Valid: 11 digits
        "123",                  # Invalid: too short
        "ABC DEF GHIJ",         # Invalid: no digits
    ]

    for phone in test_phones:
        is_valid = client._is_valid_phone(phone)
        status = "✓" if is_valid else "✗"
        logger.info(f"{status} {phone}")


async def main():
    """Run all tests."""
    logger.info("\n")
    logger.info("╔" + "=" * 58 + "╗")
    logger.info("║" + " " * 58 + "║")
    logger.info("║" + "  CRAWL4AI CLIENT TEST SUITE".center(58) + "║")
    logger.info("║" + " " * 58 + "║")
    logger.info("╚" + "=" * 58 + "╝")
    logger.info("\n")

    # Run tests
    await test_email_extraction()
    logger.info("")

    await test_phone_extraction()
    logger.info("")

    await test_phone_validation()
    logger.info("")

    # NOTE: Uncomment these to test with real domains (requires internet)
    # await test_single_domain()
    # logger.info("")
    #
    # await test_with_contact_page()
    # logger.info("")
    #
    # await test_multiple_domains()

    logger.info("\n")
    logger.info("═" * 60)
    logger.info("All tests completed!")
    logger.info("═" * 60)


if __name__ == "__main__":
    asyncio.run(main())
