# test_phase2_integration.py

import unittest
from spa_detector import SPADetector
from header_nav_analyzer import HeaderNavAnalyzer


class TestPhase2Integration(unittest.TestCase):
    """Интеграционный тест ФАЗЫ 2"""

    def test_spa_detection_and_header_analysis(self):
        """Проверяем полный pipeline SPA + Header detection"""

        # HTML Next.js приложения с контактами в header
        nextjs_html = """
        <html>
        <head>
            <meta name="viewport" content="width=device-width">
            <script src="/_next/static/chunks/main.js"></script>
        </head>
        <body>
            <header>
                <nav>
                    <a href="/">Home</a>
                    <a href="/about">About</a>
                    <a href="/contact">Contact Us</a>
                </nav>
            </header>
            <div id="__next">
                <main>Content</main>
            </div>
        </body>
        </html>
        """

        # Шаг 1: Обнаруживаем что это SPA
        spa_detector = SPADetector()
        is_spa, framework, spa_conf = spa_detector.detect(nextjs_html)

        self.assertTrue(is_spa)
        self.assertEqual(framework, "react")
        self.assertGreater(spa_conf, 0.8)

        print(f"✓ SPA обнаружена: {framework} (confidence: {spa_conf:.0%})")

        # Шаг 2: Анализируем header/nav
        analyzer = HeaderNavAnalyzer()
        results = analyzer.analyze(nextjs_html)

        self.assertGreater(len(results['header']), 0)

        print(f"✓ Header контакты найдены: {len(results['header'])}")

        # Результат: мы нашли контакты быстро, не нужно проверять другие пути
        print(f"✓ SPA + Header контакты найдены → пропускаем дополнительный поиск")

    def test_traditional_vs_spa_strategy(self):
        """Проверяем что стратегия отличается для SPA vs traditional"""

        # Traditional HTML (контакты в footer)
        traditional_html = """
        <html>
        <header><nav><a href="/">Home</a></nav></header>
        <main>Content</main>
        <footer>
            <a href="/contact">Contact</a>
            <a href="mailto:info@example.com">Email</a>
        </footer>
        </html>
        """

        # SPA HTML (контакты в header)
        spa_html = """
        <html>
        <head>
            <script src="/_next/static/chunks/main.js"></script>
        </head>
        <body>
            <header>
                <a href="/contact">Contact</a>
            </header>
            <div id="__next">Content</div>
        </body>
        </html>
        """

        detector = SPADetector()
        analyzer = HeaderNavAnalyzer()

        # Traditional
        is_spa_trad, _, _ = detector.detect(traditional_html)
        results_trad = analyzer.analyze(traditional_html)

        self.assertFalse(is_spa_trad)
        self.assertEqual(len(results_trad['header']), 0)  # Контактов в header нет

        # SPA
        is_spa_spa, _, _ = detector.detect(spa_html)
        results_spa = analyzer.analyze(spa_html)

        self.assertTrue(is_spa_spa)
        self.assertGreater(len(results_spa['header']), 0)  # Контакты в header

        print("✓ Стратегия отличается для Traditional vs SPA")


class TestRealWorldScenarios(unittest.TestCase):
    """Тесты реальных сценариев"""

    def test_scenario_react_with_modal_contacts(self):
        """Сценарий: React приложение с контактами в modal"""

        html = """
        <html>
        <head>
            <script src="https://cdn.jsdelivr.net/npm/react@18/dist/react.js"></script>
        </head>
        <body>
            <header>
                <button onclick="openContactModal()">Contact Us</button>
            </header>
            <div id="root">
                <div class="modal" id="contact-modal" style="display:none">
                    <h2>Contact Information</h2>
                    <p>Email: hello@example.com</p>
                    <p>Phone: +1-234-567-8900</p>
                </div>
            </div>
        </body>
        </html>
        """

        # Обнаруживаем SPA
        detector = SPADetector()
        is_spa, framework, _ = detector.detect(html)
        self.assertTrue(is_spa)

        # Анализируем header
        analyzer = HeaderNavAnalyzer()
        results = analyzer.analyze(html)

        # Должна быть найдена button в header
        self.assertGreater(len(results['header']), 0)

        button_found = any('contact' in c.text.lower() for c in results['header'])
        self.assertTrue(button_found)

        print("✓ Сценарий React с modal контактами: PASS")

    def test_scenario_vue_with_navbar_contacts(self):
        """Сценарий: Vue приложение с контактами в navbar"""

        html = """
        <html>
        <head>
            <script src="https://cdn.jsdelivr.net/npm/vue@3/dist/vue.global.js"></script>
        </head>
        <body>
            <nav class="navbar">
                <div class="nav-links">
                    <a href="/">Home</a>
                    <a href="/services">Services</a>
                    <a href="/contact">Contact Us</a>
                    <a href="/blog">Blog</a>
                </div>
            </nav>
            <div id="app"></div>
        </body>
        </html>
        """

        # Обнаруживаем SPA
        detector = SPADetector()
        is_spa, framework, _ = detector.detect(html)
        self.assertTrue(is_spa)

        # Анализируем nav
        analyzer = HeaderNavAnalyzer()
        results = analyzer.analyze(html)

        # Должны быть найдены контакты в nav
        self.assertGreater(len(results['nav']), 0)

        print("✓ Сценарий Vue с navbar контактами: PASS")


class TestPerformance(unittest.TestCase):
    """Тесты производительности"""

    def test_large_html_performance(self):
        """Проверяем что большой HTML обрабатывается быстро"""

        import time

        # Создаем большой HTML
        large_html = """
        <html>
        <head>
            <script src="/_next/static/chunks/main.js"></script>
        </head>
        <body>
            <header>
                <nav>
                    <a href="/contact">Contact Us</a>
                </nav>
            </header>
        """

        # Добавляем много контента
        for i in range(1000):
            large_html += f'<div class="item-{i}">Item {i}</div>'

        large_html += "</body></html>"

        # Тест SPA detection
        detector = SPADetector()
        start = time.time()
        is_spa, _, _ = detector.detect(large_html)
        spa_time = time.time() - start

        # Тест Header/Nav analysis
        analyzer = HeaderNavAnalyzer()
        start = time.time()
        results = analyzer.analyze(large_html)
        analysis_time = time.time() - start

        # Обе операции должны быть быстрыми
        self.assertLess(spa_time, 1.0)  # < 1 сек
        self.assertLess(analysis_time, 1.0)  # < 1 сек

        print(f"✓ Большой HTML обрабатывается быстро:")
        print(f"  SPA detection: {spa_time*1000:.1f}ms")
        print(f"  Header/Nav analysis: {analysis_time*1000:.1f}ms")


if __name__ == "__main__":
    unittest.main(verbosity=2)
