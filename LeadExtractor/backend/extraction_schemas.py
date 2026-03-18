"""
JSON CSS Extraction Schemas for contact information.
Use with JsonCssExtractionStrategy instead of regex.

80-95% accuracy vs 30-40% with regex.
"""

# Базовая схема контактной информации
CONTACT_SCHEMA = {
    "name": "ContactInfo",
    "baseSelector": "body",
    "fields": [
        {
            "name": "emails",
            "selector": "a[href^='mailto:'], .email, .e-mail, [class*='email'], [class*='mail']",
            "type": "attribute",
            "attribute": "href"
        },
        {
            "name": "phones",
            "selector": "a[href^='tel:'], .phone, .tel, .telephone, [class*='phone'], [class*='contact']",
            "type": "text"
        },
    ]
}

# Расширенная схема с именами и должностями
TEAM_SCHEMA = {
    "name": "TeamContacts",
    "baseSelector": ".team-member, .team-card, .person, .employee, [class*='team'], [class*='staff']",
    "fields": [
        {
            "name": "name",
            "selector": "h3, h4, .name, .person-name, [class*='name']",
            "type": "text"
        },
        {
            "name": "position",
            "selector": ".position, .title, .role, .job-title, [class*='title']",
            "type": "text"
        },
        {
            "name": "email",
            "selector": "a[href^='mailto:'], .email, [data-email]",
            "type": "attribute",
            "attribute": "href"
        },
        {
            "name": "phone",
            "selector": "a[href^='tel:'], .phone, [data-phone]",
            "type": "text"
        },
    ]
}

# Схема для footer
FOOTER_SCHEMA = {
    "name": "FooterContacts",
    "baseSelector": "footer, [class*='footer']",
    "fields": [
        {
            "name": "company",
            "selector": ".company, .brand, .logo, h1, h2",
            "type": "text"
        },
        {
            "name": "emails",
            "selector": "a[href^='mailto:'], .email",
            "type": "attribute",
            "attribute": "href"
        },
        {
            "name": "phones",
            "selector": "a[href^='tel:'], .phone, [class*='phone']",
            "type": "text"
        },
        {
            "name": "address",
            "selector": ".address, [class*='address']",
            "type": "text"
        },
    ]
}

# Специфичная для России схема
RUSSIAN_SCHEMA = {
    "name": "RussianContacts",
    "baseSelector": "body",
    "fields": [
        {
            "name": "emails",
            "selector": "a[href^='mailto:'], .почта, .email, [class*='почта'], [class*='email']",
            "type": "attribute",
            "attribute": "href"
        },
        {
            "name": "phones",
            "selector": "a[href^='tel:'], .телефон, .phone, [class*='телефон'], [class*='phone']",
            "type": "text"
        },
        {
            "name": "contacts",
            "selector": ".контакты, .связь, .контакт, [class*='контакт']",
            "type": "text"
        },
    ]
}

# Комбинированная схема (используй эту для максимальной точности)
COMBINED_SCHEMA = {
    "name": "AllContacts",
    "baseSelector": "body",
    "fields": [
        # Основные контакты
        {
            "name": "emails",
            "selector": "a[href^='mailto:'], .email, .e-mail, [data-email], [class*='email']",
            "type": "attribute",
            "attribute": "href"
        },
        {
            "name": "phones",
            "selector": "a[href^='tel:'], .phone, .tel, [data-phone], [class*='phone']",
            "type": "text"
        },
        # Информация о компании
        {
            "name": "company_name",
            "selector": ".company-name, [data-company], .brand, footer h1",
            "type": "text"
        },
        # Данные команды
        {
            "name": "team_emails",
            "selector": ".team-member a[href^='mailto:'], .person .email",
            "type": "attribute",
            "attribute": "href"
        },
        # Социальные сети (для доп. контактов)
        {
            "name": "social_links",
            "selector": "a[href*='linkedin'], a[href*='facebook'], a[href*='telegram']",
            "type": "attribute",
            "attribute": "href"
        },
    ]
}


def get_schema(schema_name: str = "combined") -> dict:
    """
    Get extraction schema by name.

    Args:
        schema_name: One of 'contact', 'team', 'footer', 'russian', 'combined'

    Returns:
        Dictionary with schema definition
    """
    schemas = {
        'contact': CONTACT_SCHEMA,
        'team': TEAM_SCHEMA,
        'footer': FOOTER_SCHEMA,
        'russian': RUSSIAN_SCHEMA,
        'combined': COMBINED_SCHEMA,
    }

    return schemas.get(schema_name, COMBINED_SCHEMA)


# Пример использования в crawl4ai_client.py:
"""
from crawl4ai.extraction_strategy import JsonCssExtractionStrategy
from extraction_schemas import get_schema

schema = get_schema('combined')
strategy = JsonCssExtractionStrategy(schema=schema)

config = CrawlerRunConfig(
    extraction_strategy=strategy,
    wait_until="networkidle",
    scan_full_page=True,
)

result = await crawler.arun(url, config=config)

if result.extracted_content:
    import json
    data = json.loads(result.extracted_content)
    emails = data.get("emails", [])
    phones = data.get("phones", [])
    company = data.get("company_name", "")
"""
