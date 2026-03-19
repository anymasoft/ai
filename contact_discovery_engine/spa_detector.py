# spa_detector.py

import re
import logging
from typing import Tuple, Optional
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


class SPADetector:
    """
    Определяет является ли сайт Single Page App (React, Vue, Angular).
    Используется для адаптации стратегии поиска контактов.
    """

    # Сигнатуры для обнаружения фреймворков
    SIGNATURES = {
        "react": {
            "scripts": [r"react", r"_next", r"expo", r"gatsby"],
            "meta": [r"next"],
            "divs": [r"__react_root", r"app", r"root"],
            "confidence": 0.95
        },
        "vue": {
            "scripts": [r"vue", r"nuxt", r"vite.*vue"],
            "meta": [r"nuxt"],
            "divs": [r"__nuxt", r"app"],
            "confidence": 0.90
        },
        "angular": {
            "scripts": [r"angular", r"@angular"],
            "meta": [r"ng-app"],
            "attributes": [r"ng-app", r"ng-controller"],
            "confidence": 0.85
        },
        "svelte": {
            "scripts": [r"svelte"],
            "divs": [r"sveltekit"],
            "confidence": 0.80
        }
    }

    # Общие SPA сигнатуры (подходят для любого фреймворка)
    COMMON_SPA_SIGNALS = {
        "meta_viewport": True,  # <meta name="viewport"> в SPA очень часто
        "no_noscript": True,    # <noscript> редко в SPA (все на JS)
        "app_div": r"<div\s+id=['\"]app['\"]",  # Стандартный контейнер
        "root_div": r"<div\s+id=['\"]root['\"]",
        "bundle_js": r"<script.*bundle\.js",
        "chunk_js": r"<script.*chunk\.js",
        "spa_frameworks": r"(react|vue|angular|svelte|ember)",
    }

    def __init__(self):
        self.detected_framework = None
        self.confidence = 0
        self.is_spa = False
        self.signals_found = []

    def detect(self, html: str) -> Tuple[bool, Optional[str], float]:
        """
        Определяет является ли сайт SPA.

        Args:
            html: HTML код страницы

        Returns:
            Tuple[is_spa, framework, confidence]
            - is_spa: True если это SPA
            - framework: 'react', 'vue', 'angular', 'svelte', 'unknown', или None
            - confidence: 0.0-1.0, насколько уверены что это SPA

        Example:
            >>> detector = SPADetector()
            >>> is_spa, framework, conf = detector.detect(html)
            >>> if is_spa:
            ...     print(f"Это {framework} SPA с уверенностью {conf:.2%}")
        """

        self.detected_framework = None
        self.confidence = 0
        self.is_spa = False
        self.signals_found = []

        # Парсим HTML
        try:
            soup = BeautifulSoup(html, 'html.parser')
        except Exception as e:
            logger.warning(f"Ошибка при парсинге HTML: {e}")
            return False, None, 0

        # Собираем все элементы в одну строку для regex поиска
        html_lower = html.lower()

        # Шаг 1: Проверяем общие SPA сигналы
        common_score = self._check_common_signals(html_lower, soup)
        logger.debug(f"Common SPA signals score: {common_score:.2%}")

        # Шаг 2: Проверяем конкретные фреймворки
        framework_scores = {}
        for framework, signatures in self.SIGNATURES.items():
            score = self._check_framework_signature(html_lower, framework, signatures)
            if score > 0:
                framework_scores[framework] = score
                logger.debug(f"{framework.upper()} signature score: {score:.2%}")

        # Шаг 3: Определяем результат
        if framework_scores:
            # Есть явные признаки SPA
            self.detected_framework = max(framework_scores.items(), key=lambda x: x[1])[0]
            self.confidence = framework_scores[self.detected_framework]
            self.is_spa = self.confidence > 0.3  # Более мягкий порог

            logger.info(
                f"✓ Обнаружена SPA: {self.detected_framework.upper()} "
                f"(confidence: {self.confidence:.2%})"
            )

        elif common_score > 0.6:
            # Много общих сигналов, но конкретный фреймворк не определен
            self.is_spa = True
            self.detected_framework = "unknown"
            self.confidence = common_score

            logger.info(f"✓ Обнаружена SPA (неизвестный фреймворк), score: {common_score:.2%}")

        else:
            logger.debug(f"✗ Не обнаружена SPA (score: {common_score:.2%})")

        return self.is_spa, self.detected_framework, self.confidence

    def _check_common_signals(self, html: str, soup) -> float:
        """
        Проверяет общие сигналы SPA архитектуры.
        Возвращает score от 0 до 1.
        """
        score = 0
        total_signals = 0

        # Сигнал 1: Viewport meta tag (в SPA почти всегда)
        if soup.find('meta', {'name': 'viewport'}):
            score += 0.15
            self.signals_found.append("viewport_meta_tag")
        total_signals += 0.15

        # Сигнал 2: Наличие скрипта без src (inline bundle)
        scripts = soup.find_all('script')
        if any(s.string and len(s.string) > 100 for s in scripts):
            score += 0.1
            self.signals_found.append("inline_bundle_script")
        total_signals += 0.1

        # Сигнал 3: <div id="app"> или <div id="root">
        if soup.find('div', {'id': 'app'}) or soup.find('div', {'id': 'root'}):
            score += 0.2
            self.signals_found.append("app_or_root_div")
        total_signals += 0.2

        # Сигнал 4: Отсутствие <noscript> (в SPA ничего работает без JS)
        if not soup.find('noscript'):
            score += 0.15
            self.signals_found.append("no_noscript_tag")
        total_signals += 0.15

        # Сигнал 5: Наличие данных в window.__INITIAL_STATE__ или похожих
        if re.search(r'window\.__\w+__\s*=', html):
            score += 0.15
            self.signals_found.append("window_initial_state")
        total_signals += 0.15

        # Сигнал 6: Минифицированные скрипты (bundle.js, main.js)
        if re.search(r'<script[^>]*src=["\'].*?(bundle|main|chunk)\.js', html, re.I):
            score += 0.1
            self.signals_found.append("bundle_script")
        total_signals += 0.1

        # Нормализуем к диапазону 0-1
        return score / total_signals if total_signals > 0 else 0

    def _check_framework_signature(self, html: str, framework: str, signatures: dict) -> float:
        """
        Проверяет наличие сигнатур конкретного фреймворка.
        """
        score = 0
        found_signals = 0
        max_score = 0

        # Проверяем script tags (самый важный сигнал)
        if "scripts" in signatures:
            for pattern in signatures["scripts"]:
                if re.search(f'<script[^>]*src=["\'][^"\']*{pattern}', html, re.I):
                    max_score = max(max_score, 0.7)
                    found_signals += 1
                    self.signals_found.append(f"{framework}_script_{pattern}")
                    break  # Достаточно одного совпадения

        # Проверяем meta tags
        if "meta" in signatures:
            for pattern in signatures["meta"]:
                if re.search(f'<meta[^>]*({pattern})[^>]*>', html, re.I):
                    max_score = max(max_score, 0.5)
                    found_signals += 1
                    self.signals_found.append(f"{framework}_meta_{pattern}")

        # Проверяем div ids
        if "divs" in signatures:
            for pattern in signatures["divs"]:
                if re.search(f'<div[^>]*id=["\'].*{pattern}', html, re.I):
                    max_score = max(max_score, 0.5)
                    found_signals += 1
                    self.signals_found.append(f"{framework}_div_{pattern}")

        # Проверяем attributes
        if "attributes" in signatures:
            for pattern in signatures["attributes"]:
                if re.search(f'{pattern}', html, re.I):
                    max_score = max(max_score, 0.5)
                    found_signals += 1
                    self.signals_found.append(f"{framework}_attr_{pattern}")

        # Если нашли что-то, добавляем confidence
        if found_signals > 0:
            return max_score + (found_signals * 0.15)  # Бонус за каждый найденный сигнал

        return 0

    def get_detection_summary(self) -> dict:
        """
        Возвращает детальный отчет о детекции.
        Полезно для дебага.
        """
        return {
            "is_spa": self.is_spa,
            "framework": self.detected_framework,
            "confidence": self.confidence,
            "signals_found": self.signals_found,
            "interpretation": (
                f"Это {'SPA на ' + self.detected_framework if self.is_spa else 'традиционный сайт'} "
                f"(confidence: {self.confidence:.0%})"
            )
        }


# Тест
if __name__ == "__main__":
    logging.basicConfig(level=logging.DEBUG)

    # Пример HTML React приложения
    react_html = """
    <html>
    <head>
        <meta name="viewport" content="width=device-width">
        <script src="/_next/static/bundle.js"></script>
    </head>
    <body>
        <div id="app"></div>
        <script>
            window.__INITIAL_STATE__ = {};
        </script>
    </body>
    </html>
    """

    detector = SPADetector()
    is_spa, framework, conf = detector.detect(react_html)

    print(f"\n{'='*60}")
    print(f"SPA Detection Result:")
    print(f"{'='*60}")
    print(f"Is SPA: {is_spa}")
    print(f"Framework: {framework}")
    print(f"Confidence: {conf:.0%}")
    print(f"\nSummary:")
    summary = detector.get_detection_summary()
    for key, value in summary.items():
        print(f"  {key}: {value}")
