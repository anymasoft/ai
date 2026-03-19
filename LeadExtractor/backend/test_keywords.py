"""
Unit тесты для Contact Discovery Engine - Keywords и Scoring
"""

from contact_discovery import (
    ContactDiscoveryEngine,
    KEYWORDS_CONTACT,
    contains_keyword
)


def test_keywords():
    """Тест: Проверка keywords database"""
    print("\n" + "="*60)
    print("TEST: Keywords Database")
    print("="*60)

    # Тест HIGH_PRIORITY EN
    assert contains_keyword("contact-us", KEYWORDS_CONTACT)[0] == 3, "HIGH_PRIORITY EN failed"
    print("✅ HIGH_PRIORITY EN: 'contact-us' detected")

    # Тест HIGH_PRIORITY RU
    assert contains_keyword("контакты", KEYWORDS_CONTACT)[0] == 3, "HIGH_PRIORITY RU failed"
    print("✅ HIGH_PRIORITY RU: 'контакты' detected")

    # Тест MEDIUM_PRIORITY EN
    assert contains_keyword("about-company", KEYWORDS_CONTACT)[0] == 2, "MEDIUM_PRIORITY EN failed"
    print("✅ MEDIUM_PRIORITY EN: 'about-company' detected")

    # Тест MEDIUM_PRIORITY RU
    assert contains_keyword("о компании", KEYWORDS_CONTACT)[0] == 2, "MEDIUM_PRIORITY RU failed"
    print("✅ MEDIUM_PRIORITY RU: 'о компании' detected")

    # Тест LOW_PRIORITY EN
    assert contains_keyword("support", KEYWORDS_CONTACT)[0] == 1, "LOW_PRIORITY EN failed"
    print("✅ LOW_PRIORITY EN: 'support' detected")

    # Тест LOW_PRIORITY RU
    assert contains_keyword("поддержка", KEYWORDS_CONTACT)[0] == 1, "LOW_PRIORITY RU failed"
    print("✅ LOW_PRIORITY RU: 'поддержка' detected")

    # Тест NONE
    assert contains_keyword("random-page", KEYWORDS_CONTACT)[0] == 0, "NONE failed"
    print("✅ NONE: 'random-page' correctly identified as 0")

    # Тест empty string
    assert contains_keyword("", KEYWORDS_CONTACT)[0] == 0, "Empty string failed"
    print("✅ Empty string: correctly handled")

    print("\n✅ All keyword tests PASSED!\n")


def test_scoring():
    """Тест: Scoring функции (URL + Anchor Text)"""
    print("="*60)
    print("TEST: Scoring Functions")
    print("="*60)

    engine = ContactDiscoveryEngine()

    # TEST: score_url
    print("\n--- URL Scoring ---")

    test_cases = [
        ("/contact", 8, "HIGH_PRIORITY + close to root"),
        ("/contacts/moscow", 8, "HIGH_PRIORITY + subdirectory"),
        ("/about-company", 5, "MEDIUM_PRIORITY + close to root"),
        ("/page/support/faq", 3, "LOW_PRIORITY + close to root (3 slashes)"),
        ("/", 1, "Root URL + close to root"),
        ("/random/page/here/deep", 0, "No keywords + deep"),
    ]

    for url, expected, description in test_cases:
        score = engine.score_url(url)
        assert score == expected, f"URL scoring failed for {url}: got {score}, expected {expected}"
        print(f"✅ {description}: '{url}' → score={score}")

    # TEST: score_anchor_text
    print("\n--- Anchor Text Scoring ---")

    text_cases = [
        ("Контакты", 10, "HIGH_PRIORITY RU"),
        ("Contact Us", 10, "HIGH_PRIORITY EN"),
        ("About Our Team", 6, "MEDIUM_PRIORITY EN"),
        ("Help Center", 3, "LOW_PRIORITY EN"),
        ("", 0, "Empty text"),
        ("Random text here", 0, "No keywords"),
    ]

    for text, expected, description in text_cases:
        score = engine.score_anchor_text(text)
        assert score == expected, f"Anchor text scoring failed for '{text}': got {score}, expected {expected}"
        print(f"✅ {description}: '{text}' → score={score}")

    # TEST: Combined score
    print("\n--- Combined Score ---")

    url_score = engine.score_url("/page?id=123")  # = 1 (close to root)
    text_score = engine.score_anchor_text("Контакты")  # = 10
    total = url_score + text_score
    assert total == 11, f"Combined score failed: {total} != 11"
    print(f"✅ Combined: URL score={url_score} + Text score={text_score} = {total}")

    print("\n✅ All scoring tests PASSED!\n")


def test_footer_extraction():
    """Тест: Footer extraction"""
    print("="*60)
    print("TEST: Footer Extraction")
    print("="*60)

    engine = ContactDiscoveryEngine()

    # Тест 1: Простой footer
    html1 = """
    <html>
    <body>
    <footer>
        <a href="/contact">Contact Us</a>
        <a href="/about">About</a>
        <p>© 2024</p>
    </footer>
    </body>
    </html>
    """

    links = engine.extract_footer_links(html1)
    assert len(links) == 2, f"Footer extraction failed: got {len(links)}, expected 2"
    assert links[0] == ("/contact", "Contact Us", 3), "First link incorrect"
    assert links[1] == ("/about", "About", 3), "Second link incorrect"
    print("✅ Test 1: Simple footer with 2 links extracted")

    # Тест 2: Нет footer
    html2 = "<html><body><h1>No footer</h1></body></html>"
    links = engine.extract_footer_links(html2)
    assert len(links) == 0, f"No footer test failed: got {len(links)}, expected 0"
    print("✅ Test 2: No footer correctly returns empty list")

    # Тест 3: Footer с пустыми href
    html3 = """
    <footer>
        <a href="">Empty</a>
        <a href="/contact">Contact</a>
    </footer>
    """
    links = engine.extract_footer_links(html3)
    assert len(links) == 1, f"Empty href test failed: got {len(links)}, expected 1"
    print("✅ Test 3: Empty href correctly filtered out")

    print("\n✅ All footer extraction tests PASSED!\n")


def test_header_extraction():
    """Тест: Header extraction"""
    print("="*60)
    print("TEST: Header Extraction")
    print("="*60)

    engine = ContactDiscoveryEngine()

    # Тест 1: Header с ссылками
    html1 = """
    <html>
    <header>
        <a href="/">Home</a>
        <a href="/contact">Contact</a>
        <a href="/about">About</a>
    </header>
    </html>
    """

    links = engine.extract_header_links(html1)
    assert len(links) == 3, f"Header extraction failed: got {len(links)}, expected 3"
    assert links[1][2] == 1, "Header boost should be 1"
    print("✅ Test 1: Header with 3 links extracted (boost=1)")

    # Тест 2: Nav вместо header
    html2 = """
    <nav>
        <a href="/contact">Contact</a>
    </nav>
    """
    links = engine.extract_header_links(html2)
    assert len(links) == 1, f"Nav test failed: got {len(links)}, expected 1"
    print("✅ Test 2: Nav correctly recognized as header")

    print("\n✅ All header extraction tests PASSED!\n")


def test_spa_detection():
    """Тест: SPA detection"""
    print("="*60)
    print("TEST: SPA Detection")
    print("="*60)

    engine = ContactDiscoveryEngine()

    # Тест 1: React SPA
    html_spa = """
    <html>
    <body>
        <div id="root"></div>
        <script src="app.js"></script>
    </body>
    </html>
    """
    is_spa = engine.is_spa_application(html_spa)
    assert is_spa == True, f"React SPA detection failed: got {is_spa}, expected True"
    print("✅ Test 1: React SPA (div id='root') correctly detected")

    # Тест 2: Обычный сайт
    html_normal = """
    <html>
    <body>
        <h1>Contact us</h1>
        <p>Email: test@example.com</p>
        <p>Phone: +7 123 456 7890</p>
        <p>Address: Moscow, Russia</p>
    </body>
    </html>
    """
    is_spa = engine.is_spa_application(html_normal)
    assert is_spa == False, f"Normal HTML detection failed: got {is_spa}, expected False"
    print("✅ Test 2: Normal HTML correctly identified as NOT SPA")

    # Тест 3: Vue SPA
    html_vue = """
    <html>
    <body>
        <div id="app"></div>
        <script src="vue.js"></script>
    </body>
    </html>
    """
    is_spa = engine.is_spa_application(html_vue)
    assert is_spa == True, f"Vue SPA detection failed: got {is_spa}, expected True"
    print("✅ Test 3: Vue SPA (div id='app') correctly detected")

    print("\n✅ All SPA detection tests PASSED!\n")


def test_prioritize_queue():
    """Тест: Queue prioritization"""
    print("="*60)
    print("TEST: Queue Prioritization")
    print("="*60)

    engine = ContactDiscoveryEngine()

    # Создать очередь
    queue = [
        ("/random-page", 1),
        ("/contact", 1),
        ("/about", 1),
        ("/support", 1),
    ]

    # Scores (заранее рассчитанные)
    scores = {
        "/random-page": 0,
        "/contact": 15,
        "/about": 8,
        "/support": 5,
    }

    # Сортировать
    prioritized = engine.prioritize_queue(queue, scores)

    # Проверить порядок
    assert prioritized[0][0] == "/contact", "First should be /contact"
    assert prioritized[1][0] == "/about", "Second should be /about"
    assert prioritized[2][0] == "/support", "Third should be /support"
    assert prioritized[-1][0] == "/random-page", "Last should be /random-page"

    print("✅ Queue correctly prioritized by score:")
    for i, (url, depth) in enumerate(prioritized):
        score = scores[url]
        print(f"   {i+1}. {url} (score={score})")

    print("\n✅ All queue prioritization tests PASSED!\n")


def test_multi_seed_strategy():
    """Тест: Multi-seed strategy"""
    print("="*60)
    print("TEST: Multi-Seed Strategy")
    print("="*60)

    engine = ContactDiscoveryEngine()

    # Тест 1: HTTP URL
    base_url = "https://example.com"
    seeds = engine.multi_seed_strategy(base_url)

    assert len(seeds) == 4, f"Multi-seed failed: got {len(seeds)}, expected 4"
    assert seeds[0] == "https://example.com", "First seed should be base URL"
    print("✅ Test 1: Generated 4 seed URLs")
    for i, url in enumerate(seeds):
        print(f"   {i+1}. {url}")

    # Тест 2: URL с path
    base_url = "https://example.com/en"
    seeds = engine.multi_seed_strategy(base_url)
    assert len(seeds) == 4, "Multi-seed with path failed"
    print("✅ Test 2: Multi-seed with path correctly handled")

    print("\n✅ All multi-seed strategy tests PASSED!\n")


def test_fallback_strategy():
    """Тест: Fallback strategy"""
    print("="*60)
    print("TEST: Fallback Strategy")
    print("="*60)

    engine = ContactDiscoveryEngine()

    # Тест 1: Никаких контактов → Activate fallback
    result = engine.apply_fallback(
        found_count=0,
        current_depth=2,
        current_max_depth=3,
        current_max_pages=25
    )
    assert result["should_activate"] == True, "Fallback should activate"
    assert result["new_max_depth"] == 4, "Max depth should increase to 4"
    assert result["new_max_pages"] == 40, "Max pages should increase to 40"
    print("✅ Test 1: Fallback correctly activated when no contacts found")

    # Тест 2: Есть контакты → Не активировать fallback
    result = engine.apply_fallback(
        found_count=2,
        current_depth=1,
        current_max_depth=3,
        current_max_pages=25
    )
    assert result["should_activate"] == False, "Fallback should NOT activate"
    assert result["new_max_depth"] == 3, "Max depth should remain unchanged"
    print("✅ Test 2: Fallback NOT activated when contacts found")

    # Тест 3: Ранний depth → Не активировать еще
    result = engine.apply_fallback(
        found_count=0,
        current_depth=1,
        current_max_depth=3,
        current_max_pages=25
    )
    assert result["should_activate"] == False, "Fallback should NOT activate early"
    print("✅ Test 3: Fallback NOT activated at early depth")

    print("\n✅ All fallback strategy tests PASSED!\n")


if __name__ == "__main__":
    print("\n" + "="*60)
    print("CONTACT DISCOVERY ENGINE - COMPREHENSIVE TESTS")
    print("="*60)

    test_keywords()
    test_scoring()
    test_footer_extraction()
    test_header_extraction()
    test_spa_detection()
    test_prioritize_queue()
    test_multi_seed_strategy()
    test_fallback_strategy()

    print("\n" + "="*60)
    print("✅ ALL TESTS PASSED SUCCESSFULLY!")
    print("="*60 + "\n")
