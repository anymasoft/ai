"""
Contact Discovery Engine v1.0
Система интеллектуального поиска контактов на веб-сайтах.

Архитектура:
- KEYWORDS: Многоуровневая база keywords (HIGH/MEDIUM/LOW priority)
- SCORING: URL scoring + Anchor text scoring
- EXTRACTION: Footer + Header links extraction
- DETECTION: SPA application detection
- STRATEGY: Multi-seed + Queue prioritization + Fallback
"""

from typing import List, Tuple, Dict, Optional
from bs4 import BeautifulSoup
import logging
from urllib.parse import urlparse, urljoin
from collections import deque

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════
# KEYWORDS DATABASE - RU + EN
# ═══════════════════════════════════════════════════════════════

KEYWORDS_CONTACT = {
    "HIGH_PRIORITY": {
        "EN": [
            "contact", "contacts", "contact-us", "contact_us",
            "get-in-touch", "get in touch", "reach-us", "reach us"
        ],
        "RU": [
            "контакты", "контакт", "связаться", "связь",
            "подвязь с нами", "напишите нам", "напишите"
        ],
    },
    "MEDIUM_PRIORITY": {
        "EN": [
            "about", "about-us", "about_us", "company", "team",
            "office", "headquarters", "location", "locations"
        ],
        "RU": [
            "о нас", "о компании", "команда", "офис",
            "реквизиты", "адрес", "местоположение", "о фирме"
        ],
    },
    "LOW_PRIORITY": {
        "EN": [
            "support", "help", "feedback", "faq", "inquiry",
            "request", "form", "subscribe"
        ],
        "RU": [
            "поддержка", "помощь", "обратная связь",
            "часто спрашиваемое", "обращение", "форма", "подписка"
        ],
    }
}


def contains_keyword(url_or_text: str, keywords_dict: Dict) -> Tuple[int, Optional[str]]:
    """
    Проверяет содержит ли текст keywords из словаря.

    Возвращает (tier_value, matched_keyword):
    - tier_value: HIGH=3, MEDIUM=2, LOW=1, NONE=0
    - matched_keyword: первый найденный keyword или None
    """
    if not url_or_text:
        return (0, None)

    text_lower = url_or_text.lower()

    # Проверить HIGH_PRIORITY
    for keyword in KEYWORDS_CONTACT.get("HIGH_PRIORITY", {}).get("EN", []) + \
                   KEYWORDS_CONTACT.get("HIGH_PRIORITY", {}).get("RU", []):
        if keyword in text_lower:
            return (3, keyword)

    # Проверить MEDIUM_PRIORITY
    for keyword in KEYWORDS_CONTACT.get("MEDIUM_PRIORITY", {}).get("EN", []) + \
                   KEYWORDS_CONTACT.get("MEDIUM_PRIORITY", {}).get("RU", []):
        if keyword in text_lower:
            return (2, keyword)

    # Проверить LOW_PRIORITY
    for keyword in KEYWORDS_CONTACT.get("LOW_PRIORITY", {}).get("EN", []) + \
                   KEYWORDS_CONTACT.get("LOW_PRIORITY", {}).get("RU", []):
        if keyword in text_lower:
            return (1, keyword)

    return (0, None)


# ═══════════════════════════════════════════════════════════════
# CONTACT DISCOVERY ENGINE
# ═══════════════════════════════════════════════════════════════

class ContactDiscoveryEngine:
    """Contact Discovery Engine для оптимизации поиска контактов."""

    def __init__(self):
        """Инициализация engine'а."""
        self.logger = logger

    def score_url(self, url: str) -> int:
        """
        Scoring URL по keywords.

        Логика:
        +7  для HIGH_PRIORITY keyword (contact, контакты)
        +4  для MEDIUM_PRIORITY keyword (about, о нас)
        +2  для LOW_PRIORITY keyword (support, поддержка)
        +1  если URL близко к корню (≤3 слэша)

        Возвращает число 0-20.
        """
        if not url:
            return 0

        url_lower = url.lower()
        score = 0

        # Проверить HIGH_PRIORITY (максимум один раз)
        for keyword in KEYWORDS_CONTACT["HIGH_PRIORITY"]["EN"] + \
                       KEYWORDS_CONTACT["HIGH_PRIORITY"]["RU"]:
            if keyword in url_lower:
                score += 7
                break

        # Проверить MEDIUM_PRIORITY (максимум один раз)
        for keyword in KEYWORDS_CONTACT["MEDIUM_PRIORITY"]["EN"] + \
                       KEYWORDS_CONTACT["MEDIUM_PRIORITY"]["RU"]:
            if keyword in url_lower:
                score += 4
                break

        # Проверить LOW_PRIORITY (максимум один раз)
        for keyword in KEYWORDS_CONTACT["LOW_PRIORITY"]["EN"] + \
                       KEYWORDS_CONTACT["LOW_PRIORITY"]["RU"]:
            if keyword in url_lower:
                score += 2
                break

        # Бонус за близость к корню (не более 3 слэшей)
        slash_count = url.count('/')
        if slash_count <= 3:
            score += 1

        return min(score, 20)  # Макс 20

    def score_anchor_text(self, text: str) -> int:
        """
        Scoring текста ссылки (anchor text).

        Логика:
        +10 для HIGH_PRIORITY keyword в тексте
        +6  для MEDIUM_PRIORITY keyword в тексте
        +3  для LOW_PRIORITY keyword в тексте

        Возвращает число 0-30.
        """
        if not text:
            return 0

        text_lower = text.lower()
        score = 0

        # Проверить HIGH_PRIORITY
        for keyword in KEYWORDS_CONTACT["HIGH_PRIORITY"]["EN"] + \
                       KEYWORDS_CONTACT["HIGH_PRIORITY"]["RU"]:
            if keyword in text_lower:
                score += 10
                break

        # Проверить MEDIUM_PRIORITY
        for keyword in KEYWORDS_CONTACT["MEDIUM_PRIORITY"]["EN"] + \
                       KEYWORDS_CONTACT["MEDIUM_PRIORITY"]["RU"]:
            if keyword in text_lower:
                score += 6
                break

        # Проверить LOW_PRIORITY
        for keyword in KEYWORDS_CONTACT["LOW_PRIORITY"]["EN"] + \
                       KEYWORDS_CONTACT["LOW_PRIORITY"]["RU"]:
            if keyword in text_lower:
                score += 3
                break

        return min(score, 30)  # Макс 30

    def extract_footer_links(self, html: str) -> List[Tuple[str, str, int]]:
        """
        Извлечение ссылок из footer.

        Возвращает список (url, anchor_text, boost).
        boost = 3 (30% улучшение для footer links)
        """
        if not html:
            return []

        try:
            soup = BeautifulSoup(html, 'html.parser')
            footer = soup.find("footer")

            if not footer:
                self.logger.debug("[Footer] No footer found in HTML")
                return []

            links = []
            for link in footer.find_all("a", href=True):
                href = link.get("href", "").strip()
                text = link.get_text(strip=True)

                if href and text:  # Только если оба есть
                    links.append((href, text, 3))  # boost = 3

            self.logger.info(f"[Footer] Found {len(links)} links in footer")
            return links

        except Exception as e:
            self.logger.error(f"[Footer] Error extracting footer links: {e}")
            return []

    def extract_header_links(self, html: str) -> List[Tuple[str, str, int]]:
        """
        Извлечение ссылок из header/nav.

        Возвращает список (url, anchor_text, boost).
        boost = 1 (10% улучшение для header links - меньше чем footer)
        """
        if not html:
            return []

        try:
            soup = BeautifulSoup(html, 'html.parser')

            # Ищем header или nav
            header = soup.find("header")
            nav = soup.find("nav")
            header_section = header or nav

            if not header_section:
                self.logger.debug("[Header] No header/nav found in HTML")
                return []

            links = []
            for link in header_section.find_all("a", href=True):
                href = link.get("href", "").strip()
                text = link.get_text(strip=True)

                if href and text:  # Только если оба есть
                    links.append((href, text, 1))  # boost = 1 (меньше чем footer)

            self.logger.info(f"[Header] Found {len(links)} links in header/nav")
            return links

        except Exception as e:
            self.logger.error(f"[Header] Error extracting header links: {e}")
            return []

    def is_spa_application(self, html: str) -> bool:
        """
        Обнаружение SPA приложений (React, Vue, Angular).

        Признаки SPA:
        - <div id="app"> или <div id="root">
        - Минимум HTML в body (< 500 chars)
        - Ссылки с #/ или pushState

        Возвращает True если это SPA.
        """
        if not html:
            return False

        html_lower = html.lower()

        # Признак 1: app/root divs
        has_app_div = '<div id="app">' in html_lower or '<div id="root">' in html_lower

        # Признак 2: Очень мало HTML в body
        try:
            soup = BeautifulSoup(html, 'html.parser')
            body = soup.find("body")
            if body:
                body_text_length = len(body.get_text())
                has_minimal_html = body_text_length < 500
            else:
                has_minimal_html = False
        except:
            has_minimal_html = False

        # Признак 3: Хеш-роуты (#/)
        has_hash_routes = '/#/' in html or '#/' in html_lower

        # SPA если есть 2+ признака
        spa_score = sum([has_app_div, has_minimal_html, has_hash_routes])
        is_spa = spa_score >= 2

        if is_spa:
            self.logger.info("[SPA] Detected SPA application")

        return is_spa

    def prioritize_queue(self, queue: List[Tuple], url_scores: Dict[str, int]) -> List[Tuple]:
        """
        Сортирует очередь по scores.

        Args:
        - queue: Список (url, depth) ссылок
        - url_scores: Dict {url: score} с предсчитанными scores

        Возвращает отсортированный queue где высокие scores первыми.
        """
        # Проверить что queue это список
        if not isinstance(queue, list) and not hasattr(queue, '__iter__'):
            self.logger.warning("[PrioritizeQueue] Queue is not iterable, returning as-is")
            return list(queue)

        # Сортировать по score (descending)
        def get_score(item):
            if isinstance(item, (tuple, list)) and len(item) > 0:
                url = item[0]
                return url_scores.get(url, 0)
            return 0

        try:
            prioritized = sorted(queue, key=get_score, reverse=True)
            self.logger.info(f"[PrioritizeQueue] Sorted {len(prioritized)} URLs by score")
            return prioritized
        except Exception as e:
            self.logger.error(f"[PrioritizeQueue] Error sorting queue: {e}")
            return list(queue)

    def multi_seed_strategy(self, base_url: str) -> List[str]:
        """
        Генерирует список seed URLs для параллельного обхода.

        Возвращает список из 4 URL'ов:
        1. Главная страница
        2. /contact или /contacts
        3. /about или /about-us
        4. /team (опционально)
        """
        seed_urls = [
            base_url,  # Главная
            urljoin(base_url, "/contact"),
            urljoin(base_url, "/contacts"),
            urljoin(base_url, "/about"),
        ]

        self.logger.info(f"[MultiSeed] Generated {len(seed_urls)} seed URLs")
        for url in seed_urls:
            self.logger.debug(f"  - {url}")

        return seed_urls

    def apply_fallback(self, found_count: int, current_depth: int,
                      current_max_depth: int, current_max_pages: int) -> Dict:
        """
        Применить fallback стратегию если контакты не найдены.

        Если найдено 0 контактов после первых нескольких страниц:
        - Увеличить max_depth с 3 до 4
        - Увеличить max_pages с 25 до 40

        Возвращает Dict с новыми параметрами:
        {
            "should_activate": bool,
            "new_max_depth": int,
            "new_max_pages": int,
            "reason": str
        }
        """
        should_activate = found_count == 0 and current_depth >= 2

        result = {
            "should_activate": should_activate,
            "new_max_depth": current_max_depth,
            "new_max_pages": current_max_pages,
            "reason": ""
        }

        if should_activate:
            result["new_max_depth"] = min(current_max_depth + 1, 5)  # Max 5
            result["new_max_pages"] = min(current_max_pages + 15, 50)  # Max 50
            result["reason"] = f"No contacts found, activating fallback. Depth: {current_max_depth}->{result['new_max_depth']}, Pages: {current_max_pages}->{result['new_max_pages']}"
            self.logger.info(f"[Fallback] {result['reason']}")

        return result
