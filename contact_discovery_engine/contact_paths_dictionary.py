# contact_paths_dictionary.py

class ContactPathDictionary:
    """
    Словарь всех возможных путей контактов с приоритизацией.
    Включает английские и русские варианты.
    """

    # TIER 1 - Основные пути (обязательны для проверки)
    TIER_1_EN = [
        "/contact",
        "/contacts",
        "/contact-us",
    ]

    TIER_1_RU = [
        "/kontakty",
        "/svyazatsya",
        "/obraschenie",
    ]

    # TIER 2 - Стандартные альтернативы (обязательны)
    TIER_2_EN = [
        "/about",
        "/about-us",
        "/company",
        "/get-in-touch",
        "/reach-out",
        "/feedback",
    ]

    TIER_2_RU = [
        "/o-nas",
        "/o-kompanii",
        "/kompaniya",
        "/obrashchenie-forma",
        "/svyazi",
        "/obratnaya-svyaz",
    ]

    # TIER 3 - Нишевые пути (проверяем если Tier 1-2 пусто)
    TIER_3_EN = [
        "/support/contact",
        "/customer-support",
        "/help/contact",
        "/contact-support",
        "/company/contact",
        "/team/contact",
        "/business/contact",
        "/service/contact",
        "/inquiry",
        "/request",
        "/form",
        "/message",
    ]

    TIER_3_RU = [
        "/company/kontakty",
        "/podderzka",
        "/svyaz",
        "/forma-svyazi",
        "/zapros",
        "/obraschenie-forma",
        "/anketa",
    ]

    # TIER 4 - Fallback пути (используем как последняя надежда)
    TIER_4_EN = [
        "/contact-form",
        "/contact-page",
        "/connect",
        "/say-hello",
        "/lets-talk",
        "/talk-to-us",
        "/contact-now",
    ]

    TIER_4_RU = [
        "/forma-obratnoj-svyazi",
        "/connect",
        "/davajte-obshchatsya",
        "/svyazites-s-nami",
    ]

    @classmethod
    def get_seed_urls(cls, domain, language="auto"):
        """
        Генерирует список seed URLs в порядке приоритета.

        Args:
            domain: Домен без слэша (https://example.com)
            language: 'en', 'ru', или 'auto' (оба)

        Returns:
            List[tuple]: [(url, priority_score, tier), ...]
            priority_score: 100 (Tier 1) - 40 (Tier 4)
            tier: 1, 2, 3, 4

        Example:
            >>> urls = ContactPathDictionary.get_seed_urls('https://example.com')
            >>> urls[0]
            ('https://example.com/contact', 100, 1)
            >>> len(urls)
            28
        """
        seed_urls = []

        # Определяем какие языки использовать
        use_en = language in ("en", "auto")
        use_ru = language in ("ru", "auto")

        # Добавляем Tier 1 (приоритет 100)
        if use_en:
            for path in cls.TIER_1_EN:
                seed_urls.append((f"{domain}{path}", 100, 1))
        if use_ru:
            for path in cls.TIER_1_RU:
                seed_urls.append((f"{domain}{path}", 100, 1))

        # Добавляем Tier 2 (приоритет 80)
        if use_en:
            for path in cls.TIER_2_EN:
                seed_urls.append((f"{domain}{path}", 80, 2))
        if use_ru:
            for path in cls.TIER_2_RU:
                seed_urls.append((f"{domain}{path}", 80, 2))

        # Добавляем Tier 3 (приоритет 60)
        if use_en:
            for path in cls.TIER_3_EN:
                seed_urls.append((f"{domain}{path}", 60, 3))
        if use_ru:
            for path in cls.TIER_3_RU:
                seed_urls.append((f"{domain}{path}", 60, 3))

        # Добавляем Tier 4 (приоритет 40) - только если нужен fallback
        if use_en:
            for path in cls.TIER_4_EN:
                seed_urls.append((f"{domain}{path}", 40, 4))
        if use_ru:
            for path in cls.TIER_4_RU:
                seed_urls.append((f"{domain}{path}", 40, 4))

        return seed_urls


# Тест словаря
if __name__ == "__main__":
    urls = ContactPathDictionary.get_seed_urls("https://example.com")
    print(f"Всего путей: {len(urls)}")
    print("\nПервые 5 путей (Tier 1):")
    for url, score, tier in urls[:5]:
        print(f"  {url} (приоритет: {score}, tier: {tier})")
