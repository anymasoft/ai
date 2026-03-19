# test_spa_detector.py

import unittest
from spa_detector import SPADetector


class TestSPADetector(unittest.TestCase):
    """Тесты для обнаружения SPA"""

    def setUp(self):
        self.detector = SPADetector()

    def test_detect_react_nextjs(self):
        """Проверяем обнаружение Next.js (React)"""

        html = """
        <html>
        <head>
            <meta name="viewport" content="width=device-width">
            <script src="/_next/static/chunks/main.js"></script>
        </head>
        <body>
            <div id="__next"></div>
        </body>
        </html>
        """

        is_spa, framework, confidence = self.detector.detect(html)

        self.assertTrue(is_spa)
        self.assertEqual(framework, "react")
        self.assertGreater(confidence, 0.8)

        print(f"✓ Next.js обнаружен (confidence: {confidence:.0%})")

    def test_detect_vue_nuxt(self):
        """Проверяем обнаружение Nuxt (Vue)"""

        html = """
        <html>
        <head>
            <meta name="viewport" content="width=device-width">
            <script src="/_nuxt/nuxt.js"></script>
        </head>
        <body>
            <div id="__nuxt"></div>
        </body>
        </html>
        """

        is_spa, framework, confidence = self.detector.detect(html)

        self.assertTrue(is_spa)
        self.assertEqual(framework, "vue")
        self.assertGreater(confidence, 0.8)

        print(f"✓ Nuxt обнаружен (confidence: {confidence:.0%})")

    def test_detect_angular(self):
        """Проверяем обнаружение Angular"""

        html = """
        <html>
        <head>
            <meta name="viewport" content="width=device-width">
            <script src="/@angular/core"></script>
            <script src="/main.js"></script>
        </head>
        <body>
            <app-root></app-root>
            <div id="app"></div>
            <script>
                window.__INITIAL_STATE__ = {};
            </script>
        </body>
        </html>
        """

        is_spa, framework, confidence = self.detector.detect(html)

        # Angular должна быть обнаружена
        self.assertTrue(is_spa)
        self.assertEqual(framework, "angular")
        self.assertGreater(confidence, 0.5)

        print(f"✓ Angular обнаружена (framework: {framework}, confidence: {confidence:.0%})")

    def test_no_spa_traditional(self):
        """Проверяем что традиционный сайт НЕ считается SPA"""

        html = """
        <html>
        <head>
            <title>Traditional Site</title>
        </head>
        <body>
            <header>Header</header>
            <main>Content</main>
            <footer>Footer</footer>
        </body>
        </html>
        """

        is_spa, framework, confidence = self.detector.detect(html)

        self.assertFalse(is_spa)
        self.assertEqual(framework, None)
        self.assertLess(confidence, 0.5)

        print(f"✓ Традиционный сайт НЕ считается SPA (confidence: {confidence:.0%})")

    def test_detection_summary(self):
        """Проверяем что summary возвращает правильный формат"""

        react_html = """
        <html>
        <head>
            <script src="/_next/static/chunks/main.js"></script>
            <div id="app"></div>
        </head>
        </html>
        """

        self.detector.detect(react_html)
        summary = self.detector.get_detection_summary()

        self.assertIn('is_spa', summary)
        self.assertIn('framework', summary)
        self.assertIn('confidence', summary)
        self.assertIn('signals_found', summary)
        self.assertIn('interpretation', summary)

        print(f"✓ Summary имеет правильный формат")
        print(f"  Interpretation: {summary['interpretation']}")


class TestSPADetectorEdgeCases(unittest.TestCase):
    """Тесты граничных случаев"""

    def test_empty_html(self):
        """Проверяем обработку пустого HTML"""

        detector = SPADetector()
        is_spa, framework, confidence = detector.detect("")

        self.assertFalse(is_spa)
        self.assertEqual(framework, None)

        print("✓ Пустой HTML обрабатывается корректно")

    def test_malformed_html(self):
        """Проверяем обработку некорректного HTML"""

        detector = SPADetector()
        html = "<html><body><div>Unclosed tags"

        is_spa, framework, confidence = detector.detect(html)

        # Не должна быть ошибка
        self.assertIsNotNone(is_spa)
        self.assertIsNotNone(confidence)

        print("✓ Некорректный HTML обрабатывается без ошибок")

    def test_false_positive_jquery(self):
        """Проверяем что jQuery сайт не считается SPA"""

        detector = SPADetector()
        html = """
        <html>
        <body>
            <script src="/jquery.js"></script>
            <script>
                $(document).ready(function() {
                    // jQuery код
                });
            </script>
        </body>
        </html>
        """

        is_spa, framework, confidence = detector.detect(html)

        # jQuery - это НЕ SPA framework
        self.assertFalse(is_spa)

        print("✓ jQuery сайт не считается SPA")


if __name__ == "__main__":
    unittest.main(verbosity=2)
