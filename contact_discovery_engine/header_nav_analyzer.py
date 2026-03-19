# header_nav_analyzer.py

import re
import logging
from typing import List, Dict, Tuple
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


class Contact:
    """Простой класс для представления найденного контакта"""
    def __init__(self, text: str, link: str, location: str, score: int):
        self.text = text
        self.link = link
        self.location = location  # 'header', 'nav', 'footer', 'content'
        self.score = score

    def __repr__(self):
        return f"Contact('{self.text}' @ {self.link}, {self.location})"


class HeaderNavAnalyzer:
    """
    Анализирует header и navigation элементы для поиска контактов.
    Используется вместе с footer analyzer для полного покрытия.
    """

    # Keywords для обнаружения контактов
    EN_KEYWORDS = ["contact", "reach", "get-in-touch", "talk", "message", "email", "phone"]
    RU_KEYWORDS = [
        "kontakt", "svyaz", "obrashchenie", "svyazatsya", "zvonit", "email", "telefon",
        # Русские слова на кириллице
        "контакт", "связь", "обращение", "свяжитесь", "звонить", "телефон", "почта"
    ]

    def __init__(self):
        self.header_contacts = []
        self.nav_contacts = []
        self.sticky_contacts = []

    def analyze(self, html: str) -> Dict[str, List[Contact]]:
        """
        Анализирует HTML и находит контакты в header/nav.

        Args:
            html: HTML код страницы

        Returns:
            Dict с разными типами контактов:
            {
                'header': [Contact, Contact, ...],
                'nav': [Contact, Contact, ...],
                'sticky': [Contact, Contact, ...],
            }

        Example:
            >>> analyzer = HeaderNavAnalyzer()
            >>> results = analyzer.analyze(html)
            >>> if results['header']:
            ...     print(f"Найдено {len(results['header'])} контактов в header")
        """

        self.header_contacts = []
        self.nav_contacts = []
        self.sticky_contacts = []

        try:
            soup = BeautifulSoup(html, 'html.parser')
        except Exception as e:
            logger.warning(f"Ошибка при парсинге HTML: {e}")
            return {
                'header': [],
                'nav': [],
                'sticky': []
            }

        # Шаг 1: Найти и анализировать <header> элемент
        self._analyze_header_section(soup)
        logger.debug(f"Найдено {len(self.header_contacts)} контактов в <header>")

        # Шаг 2: Найти и анализировать <nav> элементы
        self._analyze_nav_section(soup)
        logger.debug(f"Найдено {len(self.nav_contacts)} контактов в <nav>")

        # Шаг 3: Найти sticky/fixed элементы
        self._analyze_sticky_elements(soup)
        logger.debug(f"Найдено {len(self.sticky_contacts)} контактов в sticky элементах")

        return {
            'header': self.header_contacts,
            'nav': self.nav_contacts,
            'sticky': self.sticky_contacts,
        }

    def _analyze_header_section(self, soup: BeautifulSoup):
        """Анализирует <header> элемент"""

        headers = soup.find_all('header')

        for header in headers:
            # Ищем все ссылки в header
            links = header.find_all('a')

            for link in links:
                contact = self._check_if_contact_link(link, location='header')
                if contact:
                    self.header_contacts.append(contact)
                    logger.debug(f"  ✓ Header contact: {contact.text} → {contact.link}")

            # Ищем кнопки в header (для SPA)
            buttons = header.find_all('button')
            for button in buttons:
                if self._has_contact_keyword(button.get_text()):
                    score = self._calculate_button_score(button, location='header')
                    if score >= 4:  # Минимальный порог для button
                        contact = Contact(
                            text=button.get_text().strip()[:100],
                            link=button.get('data-href', button.get('onclick', '')),
                            location='header',
                            score=score
                        )
                        self.header_contacts.append(contact)
                        logger.debug(f"  ✓ Header button contact: {contact.text}")

    def _analyze_nav_section(self, soup: BeautifulSoup):
        """Анализирует <nav> элементы и навигацию"""

        navs = soup.find_all('nav')

        for nav in navs:
            # Ищем все ссылки в nav
            links = nav.find_all('a')

            for link in links:
                contact = self._check_if_contact_link(link, location='nav')
                if contact:
                    self.nav_contacts.append(contact)
                    logger.debug(f"  ✓ Nav contact: {contact.text} → {contact.link}")

            # Ищем list items (часто в nav)
            items = nav.find_all('li')
            for item in items:
                link = item.find('a')
                if link:
                    contact = self._check_if_contact_link(link, location='nav')
                    if contact:
                        self.nav_contacts.append(contact)

    def _analyze_sticky_elements(self, soup: BeautifulSoup):
        """Анализирует sticky/fixed элементы (мобильная навигация, sticky header)"""

        # Более простой подход: ищем common sticky контейнеры
        sticky_containers = soup.find_all(
            ['div', 'header', 'nav'],
            {'class': re.compile(r'(sticky|fixed|top-bar|header-sticky)', re.I)}
        )

        for container in sticky_containers:
            links = container.find_all('a')

            for link in links:
                contact = self._check_if_contact_link(link, location='sticky')
                if contact:
                    # Увеличиваем score для sticky элементов
                    contact.score += 1
                    self.sticky_contacts.append(contact)
                    logger.debug(f"  ✓ Sticky contact: {contact.text}")

    def _check_if_contact_link(self, link_element, location: str):
        """
        Проверяет является ли ссылка контактной.

        Args:
            link_element: BeautifulSoup <a> элемент
            location: 'header', 'nav', 'sticky'

        Returns:
            Contact объект или None
        """

        text = link_element.get_text().strip()
        href = link_element.get('href', '')

        # Игнорируем пустые ссылки
        if not text or not href:
            return None

        # Игнорируем очень длинные тексты (вероятно не контакт)
        if len(text) > 100:
            return None

        # Проверяем есть ли в тексте контакт keywords
        if not self._has_contact_keyword(text):
            return None

        # Вычисляем score
        score = self._calculate_link_score(text, href, location)

        if score >= 3:  # Минимальный порог
            return Contact(
                text=text,
                link=href,
                location=location,
                score=score
            )

        return None

    def _has_contact_keyword(self, text: str) -> bool:
        """Проверяет наличие контакт-keywords в тексте"""

        text_lower = text.lower()

        # Проверяем EN keywords
        for keyword in self.EN_KEYWORDS:
            if keyword in text_lower:
                return True

        # Проверяем RU keywords
        for keyword in self.RU_KEYWORDS:
            if keyword in text_lower:
                return True

        return False

    def _calculate_link_score(self, text: str, href: str, location: str) -> int:
        """Вычисляет score контакт-ссылки"""

        score = 0
        text_lower = text.lower()
        href_lower = href.lower()

        # Базовый score в зависимости от location
        location_scores = {'header': 6, 'nav': 5, 'sticky': 4}
        score = location_scores.get(location, 3)

        # Бонусы за keywords
        if "contact" in text_lower:
            score += 2
        if "reach" in text_lower or "get-in-touch" in text_lower:
            score += 1

        # Бонусы за href
        if "/contact" in href_lower:
            score += 1
        if "/about" in href_lower:
            score -= 1  # About обычно не главный контакт

        # Email/Phone ссылки очень ценны
        if href_lower.startswith(("mailto:", "tel:")):
            score += 2

        return min(score, 10)  # Максимум 10

    def _calculate_button_score(self, button_element, location: str) -> int:
        """Вычисляет score контакт-кнопки (для SPA)"""

        score = 0

        # Базовый score в зависимости от location
        location_scores = {'header': 6, 'nav': 5, 'sticky': 4}
        score = location_scores.get(location, 3)

        text = button_element.get_text().lower()

        # Бонусы за keywords
        if "contact" in text:
            score += 2

        # Проверяем onclick, data-* атрибуты
        onclick = button_element.get('onclick', '').lower()
        if "contact" in onclick:
            score += 1

        return min(score, 10)


# Тесты
if __name__ == "__main__":
    logging.basicConfig(level=logging.DEBUG)

    # Пример HTML с контактами в header
    html_with_header_contacts = """
    <html>
    <head><title>Test</title></head>
    <body>
        <header>
            <nav>
                <a href="/">Home</a>
                <a href="/about">About</a>
                <a href="/contact">Contact Us</a>
                <a href="mailto:hello@example.com">Email</a>
            </nav>
        </header>
        <main>
            <h1>Welcome</h1>
        </main>
        <footer>
            <p>© 2024 Company</p>
        </footer>
    </body>
    </html>
    """

    analyzer = HeaderNavAnalyzer()
    results = analyzer.analyze(html_with_header_contacts)

    print(f"\n{'='*60}")
    print(f"Header/Nav Analysis Result:")
    print(f"{'='*60}")
    print(f"Header contacts: {len(results['header'])}")
    for contact in results['header']:
        print(f"  - {contact}")

    print(f"Nav contacts: {len(results['nav'])}")
    for contact in results['nav']:
        print(f"  - {contact}")

    print(f"Sticky contacts: {len(results['sticky'])}")
