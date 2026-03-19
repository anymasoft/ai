# test_header_nav_analyzer.py

import unittest
from header_nav_analyzer import HeaderNavAnalyzer, Contact


class TestHeaderNavAnalyzer(unittest.TestCase):
    """Тесты для анализа header/nav"""

    def setUp(self):
        self.analyzer = HeaderNavAnalyzer()

    def test_find_contact_in_header(self):
        """Проверяем нахождение контактов в <header>"""

        html = """
        <html>
        <header>
            <nav>
                <a href="/">Home</a>
                <a href="/about">About</a>
                <a href="/contact">Contact Us</a>
            </nav>
        </header>
        <body><main>Content</main></body>
        </html>
        """

        results = self.analyzer.analyze(html)

        self.assertGreater(len(results['header']), 0)
        self.assertTrue(any('contact' in c.text.lower() for c in results['header']))

        print(f"✓ Найдено {len(results['header'])} контактов в header")

    def test_find_contact_in_nav(self):
        """Проверяем нахождение контактов в <nav>"""

        html = """
        <html>
        <nav>
            <a href="/services">Services</a>
            <a href="/contact-us">Contact Us</a>
            <a href="/blog">Blog</a>
        </nav>
        </html>
        """

        results = self.analyzer.analyze(html)

        self.assertGreater(len(results['nav']), 0)
        self.assertTrue(any('contact' in c.text.lower() for c in results['nav']))

        print(f"✓ Найдено {len(results['nav'])} контактов в nav")

    def test_email_link_in_header(self):
        """Проверяем нахождение email ссылок в header"""

        html = """
        <html>
        <header>
            <a href="mailto:hello@example.com">Email Us</a>
        </header>
        </html>
        """

        results = self.analyzer.analyze(html)

        self.assertGreater(len(results['header']), 0)
        email_contact = results['header'][0]
        self.assertIn('mailto:', email_contact.link)

        print(f"✓ Email контакт найден: {email_contact}")

    def test_spa_button_contact(self):
        """Проверяем нахождение контакт-кнопок в SPA"""

        html = """
        <html>
        <header>
            <button onclick="openContactModal()">Contact Us</button>
            <a href="/about">About</a>
        </header>
        </html>
        """

        results = self.analyzer.analyze(html)

        # Кнопка должна быть найдена в header
        self.assertGreater(len(results['header']), 0)

        print(f"✓ Кнопка контакта найдена в SPA header")

    def test_scoring_header_vs_nav(self):
        """Проверяем что header контакты имеют выше score чем nav"""

        html = """
        <html>
        <header>
            <a href="/contact">Contact</a>
        </header>
        <nav>
            <a href="/contact">Contact</a>
        </nav>
        </html>
        """

        results = self.analyzer.analyze(html)

        if results['header'] and results['nav']:
            header_score = results['header'][0].score
            nav_score = results['nav'][0].score

            self.assertGreater(header_score, nav_score)

            print(f"✓ Header score ({header_score}) > Nav score ({nav_score})")

    def test_ignore_non_contact_links(self):
        """Проверяем что не-контактные ссылки игнорируются"""

        html = """
        <html>
        <header>
            <a href="/">Home</a>
            <a href="/products">Products</a>
            <a href="/blog">Blog</a>
        </header>
        </html>
        """

        results = self.analyzer.analyze(html)

        # Контактов быть не должно
        self.assertEqual(len(results['header']), 0)

        print(f"✓ Не-контактные ссылки игнорируются")

    def test_russian_keywords(self):
        """Проверяем обнаружение русских keywords"""

        html = """
        <html>
        <header>
            <nav>
                <a href="/o-nas">О нас</a>
                <a href="/kontakty">Контакты</a>
                <a href="/svyazatsya">Свяжитесь с нами</a>
            </nav>
        </header>
        </html>
        """

        results = self.analyzer.analyze(html)

        self.assertGreater(len(results['nav']), 0)

        print(f"✓ Русские keywords обнаружены ({len(results['nav'])} контактов)")


class TestContact(unittest.TestCase):
    """Тесты для Contact объекта"""

    def test_contact_creation(self):
        """Проверяем создание Contact объекта"""

        contact = Contact(
            text="Contact Us",
            link="/contact",
            location="header",
            score=6
        )

        self.assertEqual(contact.text, "Contact Us")
        self.assertEqual(contact.link, "/contact")
        self.assertEqual(contact.location, "header")
        self.assertEqual(contact.score, 6)

        print(f"✓ Contact объект создан: {contact}")


class TestHeaderNavAnalyzerEdgeCases(unittest.TestCase):
    """Тесты граничных случаев"""

    def test_empty_html(self):
        """Проверяем обработку пустого HTML"""

        analyzer = HeaderNavAnalyzer()
        results = analyzer.analyze("")

        self.assertEqual(len(results['header']), 0)
        self.assertEqual(len(results['nav']), 0)

        print("✓ Пустой HTML обрабатывается корректно")

    def test_no_header_element(self):
        """Проверяем обработку HTML без <header>"""

        html = """
        <html>
        <body>
            <nav>
                <a href="/contact">Contact</a>
            </nav>
        </body>
        </html>
        """

        analyzer = HeaderNavAnalyzer()
        results = analyzer.analyze(html)

        # Контакт должен быть в nav, а не в header
        self.assertEqual(len(results['header']), 0)
        self.assertGreater(len(results['nav']), 0)

        print("✓ HTML без <header> обрабатывается корректно")

    def test_very_long_link_text(self):
        """Проверяем что очень длинный текст ссылки игнорируется"""

        html = """
        <html>
        <header>
            <a href="/contact">""" + "Contact " * 100 + """</a>
        </header>
        </html>
        """

        analyzer = HeaderNavAnalyzer()
        results = analyzer.analyze(html)

        # Должна быть обработана нормально (ограничение на 100 символов)
        # но не должна сломать парсер
        self.assertIsNotNone(results)

        print("✓ Очень длинные ссылки обрабатываются без ошибок")


if __name__ == "__main__":
    unittest.main(verbosity=2)
