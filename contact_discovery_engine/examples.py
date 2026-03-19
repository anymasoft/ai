# examples.py
"""
Примеры использования Contact Discovery Engine ФАЗА 2
"""

import logging
from current_engine import ContactDiscoveryEngine
from spa_detector import SPADetector
from header_nav_analyzer import HeaderNavAnalyzer
from url_handler import URLHandler

# Включаем логирование
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)


def example_1_basic_usage():
    """
    ПРИМЕР 1: Базовое использование - обнаружение контактов на сайте
    """
    print("\n" + "="*60)
    print("ПРИМЕР 1: Базовое использование")
    print("="*60)

    engine = ContactDiscoveryEngine()

    # Пример с реальным сайтом (будет требовать интернета)
    domain = "https://example.com"
    print(f"\nПоиск контактов на {domain}...")

    try:
        contacts = engine.discover(domain)

        print(f"\nНайдено контактов: {len(contacts)}")
        if contacts:
            print("\nНайденные контакты:")
            for i, contact in enumerate(contacts[:5], 1):  # Показываем первые 5
                print(f"  {i}. {contact['type']}: {contact['text']}")
                if contact['link']:
                    print(f"     Ссылка: {contact['link']}")
    except Exception as e:
        print(f"Ошибка: {e}")


def example_2_spa_detection():
    """
    ПРИМЕР 2: Детекция SPA приложений
    """
    print("\n" + "="*60)
    print("ПРИМЕР 2: Детекция SPA приложений")
    print("="*60)

    # React/Next.js пример
    react_html = """
    <html>
    <head>
        <meta name="viewport" content="width=device-width">
        <script src="/_next/static/chunks/main.js"></script>
    </head>
    <body>
        <header>
            <a href="/contact">Contact Us</a>
        </header>
        <div id="__next">React App Content</div>
    </body>
    </html>
    """

    detector = SPADetector()
    is_spa, framework, confidence = detector.detect(react_html)

    print(f"\nНаходится ли это SPA: {is_spa}")
    print(f"Фреймворк: {framework}")
    print(f"Уверенность: {confidence:.0%}")

    if is_spa:
        summary = detector.get_detection_summary()
        print(f"\nНайденные сигналы:")
        for signal in summary['signals_found'][:5]:
            print(f"  - {signal}")

    # Vue/Nuxt пример
    print("\n" + "-"*60)
    vue_html = """
    <html>
    <head>
        <meta name="viewport" content="width=device-width">
        <script src="/_nuxt/nuxt.js"></script>
    </head>
    <body>
        <nav>
            <a href="/kontakty">Контакты</a>
        </nav>
        <div id="__nuxt">Vue App</div>
    </body>
    </html>
    """

    is_spa, framework, confidence = detector.detect(vue_html)
    print(f"\nVue/Nuxt SPA: {is_spa}")
    print(f"Фреймворк: {framework}")
    print(f"Уверенность: {confidence:.0%}")


def example_3_header_nav_analysis():
    """
    ПРИМЕР 3: Анализ контактов в header и navigation
    """
    print("\n" + "="*60)
    print("ПРИМЕР 3: Анализ header и navigation")
    print("="*60)

    html = """
    <html>
    <body>
        <header>
            <nav>
                <a href="/">Главная</a>
                <a href="/about">О нас</a>
                <a href="/kontakty">Контакты</a>
                <a href="mailto:hello@example.com">Email</a>
            </nav>
        </header>

        <nav class="navbar">
            <a href="/services">Услуги</a>
            <a href="/contact-us">Contact Us</a>
            <a href="tel:+7-999-123-45-67">Позвонить</a>
        </nav>

        <main>Основной контент сайта</main>

        <footer>
            <p>© 2024 Company</p>
        </footer>
    </body>
    </html>
    """

    analyzer = HeaderNavAnalyzer()
    results = analyzer.analyze(html)

    print(f"\nКонтакты в <header>: {len(results['header'])}")
    for contact in results['header']:
        print(f"  ✓ {contact.text} ({contact.link})")
        print(f"    Score: {contact.score}, Location: {contact.location}")

    print(f"\nКонтакты в <nav>: {len(results['nav'])}")
    for contact in results['nav']:
        print(f"  ✓ {contact.text} ({contact.link})")
        print(f"    Score: {contact.score}, Location: {contact.location}")

    print(f"\nSticky контакты: {len(results['sticky'])}")


def example_4_url_handler():
    """
    ПРИМЕР 4: Работа с URLHandler (обработка редиректов)
    """
    print("\n" + "="*60)
    print("ПРИМЕР 4: URL Handler - обработка редиректов")
    print("="*60)

    handler = URLHandler(timeout=5)

    # В реальной ситуации это будет делать HTTP запросы
    print("\nURLHandler может:")
    print("  ✓ Загружать страницы с таймаутом")
    print("  ✓ Следовать редиректам (макс 3)")
    print("  ✓ Обрабатывать 404 ошибки")
    print("  ✓ Повторять при 5xx ошибках")
    print("  ✓ Блокировать кросс-доменные редиректы")

    print("\nПримеры обработки ошибок:")
    print("  404 → возвращает None (страница не найдена)")
    print("  500+ → повторяет до 2 раз с exponential backoff")
    print("  Timeout → повторяет один раз")
    print("  301/302 → следует редиректу на тот же домен")


def example_5_real_world():
    """
    ПРИМЕР 5: Реальный пример - обнаружение контактов на разных типах сайтов
    """
    print("\n" + "="*60)
    print("ПРИМЕР 5: Реальные примеры на разных типах сайтов")
    print("="*60)

    engine = ContactDiscoveryEngine()

    # Пример 1: Традиционный сайт с контактами в footer
    print("\n1. Традиционный сайт:")
    traditional_html = """
    <html>
    <body>
        <header>Menu</header>
        <main>Content</main>
        <footer>
            <a href="/contact">Contact</a>
            <a href="mailto:info@example.com">info@example.com</a>
        </footer>
    </body>
    </html>
    """
    print("   - Контакты в footer")
    print("   - Обнаружение: ФАЗА 1 (Multi-entry strategy)")

    # Пример 2: React SPA с контактами в header
    print("\n2. React SPA приложение:")
    spa_html = """
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
        <div id="__next">App</div>
    </body>
    </html>
    """
    print("   - Контакты в header")
    print("   - Обнаружение: ФАЗА 2 (SPA + Header analysis)")

    # Пример 3: Vue SPA с контактами в nav
    print("\n3. Vue/Nuxt приложение:")
    vue_html = """
    <html>
    <head>
        <script src="/_nuxt/nuxt.js"></script>
    </head>
    <body>
        <nav>
            <a href="/kontakty">Контакты</a>
        </nav>
        <div id="__nuxt">App</div>
    </body>
    </html>
    """
    print("   - Контакты в nav")
    print("   - Обнаружение: ФАЗА 2 (SPA + Nav analysis)")

    # Пример 4: Еще предстоит (ФАЗА 3)
    print("\n4. Сайт с JSON-LD контактами (ФАЗА 3):")
    print("   - Контакты только в JSON-LD Schema")
    print("   - Обнаружение: ФАЗА 3 (Structured data parsing)")


if __name__ == "__main__":
    print("\n" + "="*60)
    print("Contact Discovery Engine - ФАЗА 2 - ПРИМЕРЫ ИСПОЛЬЗОВАНИЯ")
    print("="*60)

    # Запускаем примеры
    example_2_spa_detection()
    example_3_header_nav_analysis()
    example_4_url_handler()
    example_5_real_world()

    print("\n" + "="*60)
    print("Примеры завершены")
    print("="*60)
    print("\nДля запуска ПОЛНОГО обнаружения контактов (требует интернета):")
    print("  uncomment example_1_basic_usage()")
