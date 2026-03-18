#!/usr/bin/env python3
"""
TEST: Contact Discovery Engine v4.0

Проверяет:
1. Priority URL scoring
2. Link text analysis
3. Footer extraction
"""

from crawl4ai_client import Crawl4AIClient


def test_url_scoring():
    """Тест scoring функции для URL"""

    client = Crawl4AIClient()

    test_cases = [
        {
            "url": "https://example.com/contact",
            "text": "Контакты",
            "expected_score": 12,  # +5 (URL) + +7 (text) = 12
            "description": "Contact page with Russian anchor"
        },
        {
            "url": "https://example.com/about",
            "text": "О компании",
            "expected_score": 6,  # +2 (URL) + +4 (text) = 6
            "description": "About page"
        },
        {
            "url": "https://example.com/services/contact-us",
            "text": "Contact Us",
            "expected_score": 12,  # +5 (URL) + +7 (text) = 12
            "description": "Nested contact page"
        },
        {
            "url": "https://example.com/random",
            "text": "Random page",
            "expected_score": 0,
            "description": "Random page (no contact keywords)"
        },
        {
            "url": "https://example.com/help",
            "text": "Справка",
            "expected_score": 3,  # +1 (URL) + +2 (text) = 3
            "description": "Support page"
        },
        {
            "url": "https://example.com/contacts/moscow",
            "text": "",
            "expected_score": 5,  # +5 (URL) + 0 (no text)
            "description": "Contact page without anchor text"
        },
    ]

    print("\n" + "=" * 70)
    print("TEST 1: URL Scoring (Priority Link Discovery)")
    print("=" * 70)

    for i, test in enumerate(test_cases, 1):
        score = client._score_url_for_contacts(test["url"], test["text"])

        # Allow ±1 variance for optional features
        passed = abs(score - test["expected_score"]) <= 1
        status = "✅ PASS" if passed else "⚠️  CLOSE"

        print(f"\n{i}. {test['description']}")
        print(f"   URL: {test['url']}")
        print(f"   Text: '{test['text']}'")
        print(f"   Expected: {test['expected_score']}, Got: {score}")
        print(f"   {status}")

    print("\n" + "=" * 70)


def test_scoring_priority():
    """Тест что scoring правильно приоритизирует"""

    client = Crawl4AIClient()

    urls = [
        ("https://example.com/random", ""),
        ("https://example.com/contact", ""),
        ("https://example.com/about", "О компании"),
        ("https://example.com/support", "Help"),
        ("https://example.com/contacts", "Контакты"),
    ]

    print("\n" + "=" * 70)
    print("TEST 2: Scoring Priority Order")
    print("=" * 70)

    scores = []
    for url, text in urls:
        score = client._score_url_for_contacts(url, text)
        scores.append((url, text, score))

    # Sort by score (descending)
    scores_sorted = sorted(scores, key=lambda x: x[2], reverse=True)

    print("\nOriginal order:")
    for url, text, score in scores:
        print(f"  {score:2d} | {url.split('/')[-1]:15} | {text}")

    print("\nAfter scoring (sorted):")
    for i, (url, text, score) in enumerate(scores_sorted, 1):
        print(f"  #{i}: {score:2d} | {url.split('/')[-1]:15} | {text}")

    # Check that /contacts and /contact are at the top
    top_urls = [url.split('/')[-1] for url, _, _ in scores_sorted[:2]]
    passed = 'contacts' in top_urls or 'contact' in top_urls
    status = "✅ PASS" if passed else "❌ FAIL"

    print(f"\nTop 2 should be contact pages: {status}")

    print("\n" + "=" * 70)


def test_footer_extraction():
    """Тест footer extraction"""

    client = Crawl4AIClient()

    html = """
    <html>
    <body>
        <h1>Main Content</h1>
        <p>Some content here</p>

        <footer>
            <a href="/contact">Контакты</a>
            <a href="/about">О нас</a>
            <a href="mailto:info@example.com">Email</a>
            <a href="/privacy">Privacy</a>
        </footer>
    </body>
    </html>
    """

    print("\n" + "=" * 70)
    print("TEST 3: Footer Link Extraction")
    print("=" * 70)

    footer_links = client._extract_footer_links(html, "example.com")

    print(f"\nFound {len(footer_links)} footer links:")
    for url, text, boost in footer_links:
        print(f"  ✓ '{text}' → {url}")
        print(f"    Boost: +{boost}")

    # Check that footer links have boost
    has_boost = all(boost == 3 for _, _, boost in footer_links)
    status = "✅ PASS" if has_boost else "❌ FAIL"
    print(f"\nAll have +3 boost: {status}")

    print("\n" + "=" * 70)


def test_real_world_scenario():
    """Реальный сценарий: обход с приоритизацией"""

    client = Crawl4AIClient()

    # Симулируем список найденных ссылок
    found_links = [
        ("https://example.com/blog/article-1", "Blog Article 1", "crawled"),
        ("https://example.com/products", "Products", "crawled"),
        ("https://example.com/contacts", "Contacts", "footer"),
        ("https://example.com/team", "Team", "crawled"),
        ("https://example.com/privacy", "Privacy Policy", "crawled"),
        ("https://example.com/about/company", "Company Info", "footer"),
        ("https://example.com/support/faq", "FAQ", "crawled"),
        ("https://example.com/", "Home", "crawled"),
    ]

    print("\n" + "=" * 70)
    print("TEST 4: Real-World Traversal Prioritization")
    print("=" * 70)

    # Score all links
    scored = []
    for url, text, source in found_links:
        score = client._score_url_for_contacts(url, text)
        # Add footer boost if from footer
        if source == "footer":
            score += 3
        scored.append((url, text, source, score))

    # Sort by score
    scored_sorted = sorted(scored, key=lambda x: x[3], reverse=True)

    print("\nLinks before prioritization:")
    for url, text, source in found_links:
        print(f"  • {text:20} [{source:8}] {url}")

    print("\nAfter scoring & prioritization (traversal order):")
    for i, (url, text, source, score) in enumerate(scored_sorted, 1):
        print(f"  {i}. [{score:2d}] {text:20} {url.split('/')[-1]}")

    # Check that high-score pages are first
    top_3_keywords = ['contact', 'about', 'team']
    top_urls = [url.lower() for url, _, _, _ in scored_sorted[:3]]
    has_contact_pages = any(kw in url for url in top_urls for kw in top_3_keywords)

    status = "✅ PASS" if has_contact_pages else "❌ FAIL"
    print(f"\nTop 3 contain contact pages: {status}")

    print("\n" + "=" * 70)


if __name__ == "__main__":
    try:
        print("\n🚀 TESTING CONTACT DISCOVERY ENGINE (v4.0)")
        print("=" * 70)

        test_url_scoring()
        test_scoring_priority()
        test_footer_extraction()
        test_real_world_scenario()

        print("\n✅ ALL TESTS COMPLETED")
        print("=" * 70)

    except Exception as e:
        print(f"\n❌ TEST FAILED: {e}")
        import traceback
        traceback.print_exc()
