# current_engine.py

import logging
import re
from typing import List, Dict, Optional
from bs4 import BeautifulSoup

from spa_detector import SPADetector
from header_nav_analyzer import HeaderNavAnalyzer
from url_handler import URLHandler
from contact_paths_dictionary import ContactPathDictionary

logger = logging.getLogger(__name__)


class ContactDiscoveryEngine:
    """
    Основной класс для обнаружения контактов на сайтах.
    Включает ФАЗУ 2: SPA Detection + Header/Nav Analysis
    """

    def __init__(self, timeout=5):
        self.timeout = timeout
        self.url_handler = URLHandler(timeout=timeout)
        self.spa_detector = SPADetector()
        self.header_nav_analyzer = HeaderNavAnalyzer()

    def discover(self, domain: str) -> List[Dict]:
        """
        Основной метод обнаружения контактов.
        УЛУЧШЕНО ФАЗА 2: SPA detection + Header/Nav analysis

        Args:
            domain: URL сайта (например, https://example.com)

        Returns:
            List[Dict] - список найденных контактов
        """

        logger.info(f"Начинаем поиск контактов на {domain}")

        # Генерируем расширенный список seed URLs
        seed_urls_with_priority = ContactPathDictionary.get_seed_urls(
            domain,
            language="auto"
        )

        logger.info(f"Сгенерировано {len(seed_urls_with_priority)} seed URLs")

        # Отслеживаем найденные контакты
        discovered_contacts = []

        # НОВОЕ ФАЗА 2: Сначала загружаем главную для SPA detection
        logger.debug("Загружаем главную для SPA detection...")
        main_html, main_status, _ = self.url_handler.fetch_with_redirect_tracking(domain)

        is_spa = False
        spa_framework = None

        if main_html and main_status == 200:
            # Определяем является ли это SPA
            is_spa, spa_framework, spa_confidence = self.spa_detector.detect(main_html)

            if is_spa:
                logger.info(
                    f"✓ Обнаружена SPA: {spa_framework} "
                    f"(confidence: {spa_confidence:.0%})"
                )

            # НОВОЕ ФАЗА 2: Анализируем header/nav на главной странице
            logger.debug("Анализируем header/nav на главной...")
            header_nav_results = self.header_nav_analyzer.analyze(main_html)

            header_contacts = header_nav_results['header']
            nav_contacts = header_nav_results['nav']

            if header_contacts:
                logger.info(f"✓ Найдено {len(header_contacts)} контактов в header")
                for contact in header_contacts:
                    discovered_contacts.append({
                        'text': contact.text,
                        'link': contact.link,
                        'type': 'header_contact',
                        'location': 'header',
                        'score': contact.score
                    })

            if nav_contacts:
                logger.info(f"✓ Найдено {len(nav_contacts)} контактов в nav")
                for contact in nav_contacts:
                    discovered_contacts.append({
                        'text': contact.text,
                        'link': contact.link,
                        'type': 'nav_contact',
                        'location': 'nav',
                        'score': contact.score
                    })

        # Если SPA и уже нашли контакты - можем остановиться
        if is_spa and discovered_contacts:
            logger.info(
                f"Это SPA и контакты найдены в header/nav. "
                f"Пропускаем дополнительный поиск."
            )
            return discovered_contacts

        # Если НЕ SPA или контактов не было - продолжаем обычный поиск
        logger.debug("Продолжаем поиск контактов в специализированных путях...")

        # Обработка Tier 1 и Tier 2 (обязательно проверяем)
        tier_1_and_2 = [
            (url, priority, tier)
            for url, priority, tier in seed_urls_with_priority
            if tier <= 2
        ]

        for url, priority, tier in tier_1_and_2:
            html, status_code, final_url = self.url_handler.fetch_with_redirect_tracking(url)

            if html and status_code == 200:
                logger.info(f"✓ Загружено Tier {tier}: {final_url}")

                # Анализируем контент
                contacts = self._analyze_page(html, priority)
                if contacts:
                    logger.info(f"  Найдено {len(contacts)} контактов")
                    discovered_contacts.extend(contacts)

                    # Если нашли в Tier 1 - можем остановиться
                    if tier == 1 and len(contacts) >= 2:
                        logger.info("Найдены хорошие контакты в Tier 1, останавливаемся")
                        return discovered_contacts
            else:
                logger.debug(f"✗ Ошибка {status_code}: {url}")

        # Если Tier 1-2 не дали результатов, проверяем Tier 3
        if not discovered_contacts:
            tier_3 = [
                (url, priority, tier)
                for url, priority, tier in seed_urls_with_priority
                if tier == 3
            ]

            logger.debug(f"Tier 1-2 не дали результатов, проверяем Tier 3...")

            for url, priority, tier in tier_3:
                html, status_code, final_url = self.url_handler.fetch_with_redirect_tracking(url)

                if html and status_code == 200:
                    contacts = self._analyze_page(html, priority)
                    if contacts:
                        logger.info(f"✓ Найдено в Tier 3: {final_url}")
                        discovered_contacts.extend(contacts)
                        if len(contacts) >= 2:
                            return discovered_contacts

        # Последняя надежда: Tier 4 + fallback
        if not discovered_contacts:
            logger.info("Tier 1-3 не дали результатов, пробуем fallback...")

            # Для SPA анализируем главную более детально
            if is_spa and main_html:
                logger.debug("Детальный анализ SPA главной...")

                # Анализируем весь контент (не только footer)
                contacts = self._analyze_spa_content(main_html, priority=40)
                if contacts:
                    logger.info(f"✓ Найдено на SPA главной: {len(contacts)} контактов")
                    discovered_contacts.extend(contacts)

            # Если всё равно ничего - blind BFS
            if not discovered_contacts:
                logger.warning("Используем blind BFS...")
                discovered_contacts = self._fallback_blind_bfs(domain, depth=2)

        return discovered_contacts or []

    def _analyze_page(self, html: str, priority: int = 50) -> List[Dict]:
        """
        Анализирует HTML страницу и извлекает контакты.
        Ищет email и phone ссылки в footer и основном контенте.
        """
        contacts = []

        try:
            soup = BeautifulSoup(html, 'html.parser')
        except Exception as e:
            logger.warning(f"Ошибка при парсинге HTML: {e}")
            return contacts

        # Ищем email адреса
        email_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
        emails = re.findall(email_pattern, html)

        for email in set(emails):  # Дедублицируем
            contacts.append({
                'text': email,
                'link': f'mailto:{email}',
                'type': 'email',
                'priority': priority + 5
            })
            logger.debug(f"  ✓ Email найден: {email}")

        # Ищем телефоны
        phone_pattern = r'\+?[\d\s\-\(\)]{7,}'
        phones = re.findall(phone_pattern, html)

        for phone in set(phones):
            # Проверяем что это похоже на телефон
            if re.search(r'\d{7,}', phone.replace('-', '').replace(' ', '').replace('(', '').replace(')', '')):
                contacts.append({
                    'text': phone.strip(),
                    'link': f'tel:{phone}',
                    'type': 'phone',
                    'priority': priority + 4
                })
                logger.debug(f"  ✓ Телефон найден: {phone}")

        # Ищем ссылки на контакты
        links = soup.find_all('a')
        for link in links:
            href = link.get('href', '').lower()
            text = link.get_text().lower()

            # Контакт ссылки
            if 'contact' in href or 'contact' in text:
                if href.startswith(('http', 'mailto', 'tel')):
                    contacts.append({
                        'text': link.get_text().strip()[:100],
                        'link': link.get('href', ''),
                        'type': 'contact_link',
                        'priority': priority + 3
                    })

        return contacts

    def _analyze_spa_content(self, html: str, priority: int = 40) -> List[Dict]:
        """
        Специализированный анализ SPA контента.
        Ищет контакты в модалях, кнопках, встроенных формах.
        """

        contacts = []

        try:
            soup = BeautifulSoup(html, 'html.parser')
        except Exception as e:
            logger.warning(f"Ошибка при парсинге HTML: {e}")
            return contacts

        # Ищем все <button> элементы с контакт keywords
        buttons = soup.find_all('button')
        for button in buttons:
            text = button.get_text().lower()
            if any(kw in text for kw in ['contact', 'reach', 'email', 'call']):
                # Это потенциальный контакт button
                contact_dict = {
                    'text': button.get_text().strip()[:100],
                    'link': button.get('data-href', ''),
                    'type': 'button',
                    'priority': priority
                }
                contacts.append(contact_dict)
                logger.debug(f"  ✓ Button контакт: {contact_dict['text']}")

        # Ищем модали с контактами
        modals = soup.find_all(['div', 'section'], {'class': re.compile(r'modal|dialog|popup', re.I)})
        for modal in modals:
            text = modal.get_text().lower()
            if any(kw in text for kw in ['contact', 'reach', 'email']):
                # В модали могут быть контакты
                links = modal.find_all('a')
                for link in links:
                    if any(kw in link.get_text().lower() for kw in ['contact', 'email', 'call']):
                        contact_dict = {
                            'text': link.get_text().strip()[:100],
                            'link': link.get('href', ''),
                            'type': 'modal_link',
                            'priority': priority + 5
                        }
                        contacts.append(contact_dict)
                        logger.debug(f"  ✓ Modal контакт: {contact_dict['text']}")

        return contacts

    def _fallback_blind_bfs(self, domain: str, depth: int = 2) -> List[Dict]:
        """
        Fallback метод: слепой поиск в ширину.
        Исследует все доступные страницы на сайте.
        """
        logger.warning("Используем blind BFS fallback...")

        contacts = []
        visited = set()
        queue = [(domain, 0)]

        while queue and len(visited) < 20:  # Лимит на 20 страниц
            url, current_depth = queue.pop(0)

            if current_depth > depth or url in visited:
                continue

            visited.add(url)

            logger.debug(f"BFS: Проверяем {url} (depth {current_depth})")

            html, status, _ = self.url_handler.fetch_with_redirect_tracking(url)

            if not html or status != 200:
                continue

            # Анализируем страницу
            page_contacts = self._analyze_page(html, priority=30)
            contacts.extend(page_contacts)

            # Если нашли контакты, можем остановиться
            if page_contacts:
                logger.info(f"BFS: Найдены контакты на {url}")
                break

            # Добавляем найденные ссылки в очередь
            try:
                soup = BeautifulSoup(html, 'html.parser')
                links = soup.find_all('a')

                for link in links[:10]:  # Лимит на 10 ссылок
                    href = link.get('href', '')
                    if href.startswith('/'):
                        next_url = domain + href
                    elif href.startswith('http'):
                        # Проверяем что это тот же домен
                        if domain in href:
                            next_url = href
                        else:
                            continue
                    else:
                        continue

                    if next_url not in visited:
                        queue.append((next_url, current_depth + 1))

            except Exception as e:
                logger.debug(f"Ошибка при парсинге ссылок: {e}")

        return contacts


# Основная точка входа
if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    engine = ContactDiscoveryEngine()

    # Пример использования
    contacts = engine.discover("https://example.com")

    print(f"\n{'='*60}")
    print(f"Результаты поиска контактов:")
    print(f"{'='*60}")
    print(f"Найдено контактов: {len(contacts)}")

    for contact in contacts:
        print(f"  - {contact['type']}: {contact['text']} ({contact['link']})")
