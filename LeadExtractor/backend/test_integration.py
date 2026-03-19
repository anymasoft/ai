"""
Integration tests для Contact Discovery Engine v1.0
Проверяет что новый engine работает с crawl4ai_client

Тесты:
1. Инициализация engine в Crawl4AIClient
2. Footer extraction в контексте _traverse_links
3. Header extraction в контексте _traverse_links
4. Scoring функции используются корректно
"""

import unittest
from bs4 import BeautifulSoup
from contact_discovery import ContactDiscoveryEngine
from crawl4ai_client import Crawl4AIClient


class TestContactDiscoveryIntegration(unittest.TestCase):
    """Integration тесты для Contact Discovery Engine"""

    def setUp(self):
        """Подготовка к тестам"""
        self.engine = ContactDiscoveryEngine()
        self.client = Crawl4AIClient(timeout=30, max_pages=25, max_depth=3)

    def test_engine_initialization(self):
        """Тест 1: Engine инициализирован в Crawl4AIClient"""
        self.assertIsNotNone(self.client.discovery_engine)
        self.assertIsInstance(self.client.discovery_engine, ContactDiscoveryEngine)
        print("✅ Test 1 PASSED: Engine инициализирован")

    def test_engine_methods_exist(self):
        """Тест 2: Все методы engine доступны"""
        methods = [
            'score_url',
            'score_anchor_text',
            'extract_footer_links',
            'extract_header_links',
            'is_spa_application',
            'prioritize_queue',
            'multi_seed_strategy',
            'apply_fallback'
        ]

        for method in methods:
            self.assertTrue(
                hasattr(self.client.discovery_engine, method),
                f"Method {method} not found"
            )
        print("✅ Test 2 PASSED: Все методы engine доступны")

    def test_footer_extraction_integration(self):
        """Тест 3: Footer extraction работает в контексте"""
        html = """
        <html>
        <body>
            <main>Main content</main>
            <footer>
                <a href="/contact">Contact Us</a>
                <a href="/about">About</a>
            </footer>
        </body>
        </html>
        """

        footer_links = self.client.discovery_engine.extract_footer_links(html)
        self.assertEqual(len(footer_links), 2)
        self.assertEqual(footer_links[0][0], "/contact")
        self.assertEqual(footer_links[0][2], 3)  # boost
        print("✅ Test 3 PASSED: Footer extraction работает")

    def test_header_extraction_integration(self):
        """Тест 4: Header extraction работает в контексте"""
        html = """
        <html>
        <header>
            <a href="/">Home</a>
            <a href="/contact">Contact</a>
        </header>
        <body>Content</body>
        </html>
        """

        header_links = self.client.discovery_engine.extract_header_links(html)
        self.assertEqual(len(header_links), 2)
        self.assertEqual(header_links[0][2], 1)  # boost меньше чем footer
        print("✅ Test 4 PASSED: Header extraction работает")

    def test_scoring_functions(self):
        """Тест 5: Scoring функции используются правильно"""
        # Тест URL scoring
        url_score = self.client.discovery_engine.score_url("/contact")
        self.assertGreater(url_score, 0)

        # Тест anchor text scoring
        text_score = self.client.discovery_engine.score_anchor_text("Contact Us")
        self.assertGreater(text_score, 0)

        # Комбинированный score
        total = url_score + text_score
        self.assertGreater(total, 0)
        print("✅ Test 5 PASSED: Scoring функции работают")

    def test_spa_detection(self):
        """Тест 6: SPA detection работает"""
        html_spa = """
        <html>
        <body>
            <div id="root"></div>
            <script>// React app</script>
        </body>
        </html>
        """

        is_spa = self.client.discovery_engine.is_spa_application(html_spa)
        self.assertTrue(is_spa)
        print("✅ Test 6 PASSED: SPA detection работает")

    def test_multi_seed_strategy(self):
        """Тест 7: Multi-seed strategy работает"""
        base_url = "https://example.com"
        seeds = self.client.discovery_engine.multi_seed_strategy(base_url)

        self.assertEqual(len(seeds), 4)
        self.assertIn("/contact", seeds[1])
        self.assertIn("/about", seeds[3])
        print("✅ Test 7 PASSED: Multi-seed strategy работает")

    def test_fallback_activation(self):
        """Тест 8: Fallback strategy работает"""
        # Случай 1: Нужно активировать
        result = self.client.discovery_engine.apply_fallback(
            found_count=0,
            current_depth=2,
            current_max_depth=3,
            current_max_pages=25
        )
        self.assertTrue(result["should_activate"])

        # Случай 2: Не активировать
        result = self.client.discovery_engine.apply_fallback(
            found_count=5,
            current_depth=1,
            current_max_depth=3,
            current_max_pages=25
        )
        self.assertFalse(result["should_activate"])
        print("✅ Test 8 PASSED: Fallback strategy работает")

    def test_queue_prioritization(self):
        """Тест 9: Queue prioritization работает"""
        queue = [
            ("/page1", 1),
            ("/contact", 1),
            ("/page2", 1),
        ]

        scores = {
            "/page1": 0,
            "/contact": 15,
            "/page2": 5,
        }

        prioritized = self.client.discovery_engine.prioritize_queue(queue, scores)

        # После сортировки /contact должен быть первым
        self.assertEqual(prioritized[0][0], "/contact")
        print("✅ Test 9 PASSED: Queue prioritization работает")

    def test_real_html_example(self):
        """Тест 10: Real-world HTML example"""
        real_html = """
        <!DOCTYPE html>
        <html>
        <head><title>Company</title></head>
        <body>
            <header>
                <nav>
                    <a href="/">Home</a>
                    <a href="/about">About</a>
                    <a href="/contact">Contact</a>
                </nav>
            </header>
            <main>
                <h1>Welcome</h1>
                <p>Our company information...</p>
                <a href="/team">Meet the Team</a>
            </main>
            <footer>
                <section>
                    <h3>Quick Links</h3>
                    <a href="/contact">Contact Us</a>
                    <a href="/privacy">Privacy</a>
                    <p>Email: info@company.com</p>
                    <p>Phone: +1-800-555-0123</p>
                </section>
            </footer>
        </body>
        </html>
        """

        # Тестируем footer extraction
        footer_links = self.client.discovery_engine.extract_footer_links(real_html)
        self.assertGreater(len(footer_links), 0)

        # Тестируем header extraction
        header_links = self.client.discovery_engine.extract_header_links(real_html)
        self.assertGreater(len(header_links), 0)

        # Проверяем что /contact найден в footer
        contact_in_footer = any("/contact" in link[0] for link in footer_links)
        self.assertTrue(contact_in_footer)

        print("✅ Test 10 PASSED: Real-world HTML example работает")


class TestContactDiscoveryPerformance(unittest.TestCase):
    """Тесты производительности"""

    def setUp(self):
        self.engine = ContactDiscoveryEngine()

    def test_keywords_lookup_performance(self):
        """Тест: Быстрость поиска keywords"""
        import time

        # Поиск должен быть очень быстрым (< 1ms)
        start = time.time()
        for _ in range(1000):
            self.engine.score_url("/contact/moscow/office")
        elapsed = time.time() - start

        self.assertLess(elapsed, 1.0)  # < 1 second for 1000 iterations
        print(f"✅ Performance Test PASSED: 1000 scoring операций за {elapsed:.3f}s")

    def test_footer_extraction_performance(self):
        """Тест: Быстрость footer extraction"""
        import time

        large_html = """
        <html><body>
        """ + "\n".join([f'<a href="/page{i}">Link {i}</a>' for i in range(100)]) + """
        <footer>
        """ + "\n".join([f'<a href="/footer{i}">Footer {i}</a>' for i in range(50)]) + """
        </footer>
        </body></html>
        """

        start = time.time()
        for _ in range(100):
            self.engine.extract_footer_links(large_html)
        elapsed = time.time() - start

        self.assertLess(elapsed, 5.0)  # < 5 seconds for 100 iterations
        print(f"✅ Performance Test PASSED: 100 footer extraction операций за {elapsed:.3f}s")


if __name__ == "__main__":
    print("\n" + "="*60)
    print("CONTACT DISCOVERY ENGINE - INTEGRATION TESTS")
    print("="*60 + "\n")

    # Запустить unit тесты
    unittest.main(verbosity=2)
