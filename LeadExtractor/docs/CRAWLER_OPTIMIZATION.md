# Crawl4AI Optimization Guide

## Улучшения в crawler

### Главные изменения

#### 1. **BrowserConfig Optimization**
```python
BrowserConfig(
    headless=True,           # Headless mode
    verbose=False,           # Quiet logging
    java_script_enabled=True,  # JS rendering
    ignore_https_errors=True   # Ignore SSL warnings
)
```

#### 2. **CrawlerRunConfig с полным функционалом**
```python
CrawlerRunConfig(
    wait_until="networkidle",      # ✅ Ждем загрузки сети
    page_timeout=30000,            # ✅ 30 секунд timeout
    remove_overlay_elements=True,  # ✅ Удаляем попапы
    process_iframes=True,          # ✅ Обрабатываем iframe
    scan_full_page=True,           # ✅ Скроллим всю страницу
    word_count_threshold=10,       # ✅ Низкий порог
    keep_attrs=['href', 'mailto', 'tel']  # ✅ Сохраняем важные атрибуты
)
```

#### 3. **Множественные источники данных**
```
result.html              ← HTML для mailto/tel ссылок
result.cleaned_html     ← Чистый HTML с текстом
result.markdown         ← Форматированный markdown
```

#### 4. **Smart Link Discovery**
```python
result.links["internal"]  # Используем встроенное обнаружение ссылок
```

#### 5. **Параллельная обработка**
```python
await crawler.arun_many(
    urls=contact_pages,
    config=crawler_config,
    max_concurrent=3  # 3 одновременно
)
```

### Улучшения извлечения контактов

#### Email Extraction
- ✅ `mailto:` links из HTML
- ✅ Regex pattern из текста
- ✅ Множественные источники (HTML, cleaned HTML, markdown)
- ✅ Дедупликация

#### Phone Extraction
- ✅ `tel:` links из HTML
- ✅ Международные форматы: +1, +7, и т.д.
- ✅ US format: (123) 456-7890
- ✅ Европейские форматы
- ✅ Кириллица: +7 8 (xxx) ...
- ✅ Валидация по количеству цифр (минимум 7)

#### Contact Page Discovery
- ✅ Англоязычные: contact, about, team, company
- ✅ Русскоязычные: контакты, о-нас, свяъь
- ✅ Европейские: kontakt, kontakty
- ✅ Специальные: sales, support, callback

### Pipeline обработки

```
domain_url
    ↓
[BrowserConfig + CrawlerRunConfig]
    ↓
Crawl homepage (arun)
    ↓
Extract links (result.links["internal"])
    ↓
Find contact pages (pattern matching)
    ↓
Crawl pages in parallel (arun_many, max 3)
    ↓
Extract from 3 sources:
  - HTML (mailto, tel)
  - Cleaned HTML (regex)
  - Markdown (regex)
    ↓
Deduplicate & validate
    ↓
Return results
```

## Архитектура

### Files

```
backend/
├── main.py              # FastAPI приложение
├── crawl4ai_client.py   # ✨ NEW: Оптимизированный Crawl4AI клиент
├── extractors.py        # Legacy: для backward compatibility
└── requirements.txt     # зависимости
```

### Class: Crawl4AIClient

```python
class Crawl4AIClient:
    async def crawl_domain(domain_url)
        → Dict[emails, phones, sources]

    Private methods:
    - _extract_from_result(result)      # Множественные источники
    - _find_contact_pages(result)       # Smart discovery
    - _extract_emails_from_html(html)   # mailto: + html attrs
    - _extract_phones_from_html(html)   # tel: + html attrs
    - _extract_emails_from_text(text)   # Regex
    - _extract_phones_from_text(text)   # Regex + validation
    - _extract_internal_links(html)     # Fallback link extraction
    - _is_valid_phone(phone)            # Phone validation
    - _deduplicate_and_validate(items)  # Cleanup
```

## Configuration

### Environment

Нет нужных переменных окружения. Все конфигурируется в коде.

### Параметры Crawl4AIClient

```python
client = Crawl4AIClient(
    timeout=30,      # Page timeout в секундах
    max_pages=5      # Макс страниц на домен
)
```

### Параметры AsyncWebCrawler

Все доступные параметры:

**BrowserConfig:**
- headless (bool)
- java_script_enabled (bool)
- ignore_https_errors (bool)
- verbose (bool)
- viewport_width, viewport_height

**CrawlerRunConfig:**
- wait_until (str): "domcontentloaded", "networkidle", "load"
- page_timeout (int): ms
- scan_full_page (bool): scroll до конца
- process_iframes (bool): inline iframe контент
- remove_overlay_elements (bool): удалить popups
- wait_for (str): CSS selector для ожидания
- js_code (str): JavaScript для выполнения

## Результаты

### Что улучшилось

| Проблема | Было | Стало |
|----------|------|-------|
| Email не найден на главной | ❌ | ✅ Поиск в HTML attrs |
| Телефон не извлекается | ❌ | ✅ Поиск в tel: links |
| Контактные страницы | Hardcoded patterns | ✅ result.links |
| Параллелизм | Sequential | ✅ arun_many |
| Полнота контента | Markdown only | ✅ 3 источника |
| Overlay popups | Блокируют контент | ✅ Удаляются |
| Iframe контент | Пропускается | ✅ Обрабатывается |
| Full page content | Частично | ✅ Полная скрутка |

### Expected Results

На сайте с контактной информацией:

```
Domain: example.com
├── Homepage
│   └── Email: contact@example.com (found via mailto)
│   └── Phone: +1 555-000-0000 (found via tel link)
├── /contacts page
│   └── Phone: (555) 000-0000 (found via regex)
└── /about page
    └── Email: team@example.com (found via regex)

Result:
{
  "emails": ["contact@example.com", "team@example.com"],
  "phones": ["+1 555-000-0000", "(555) 000-0000"],
  "sources": [
    "https://example.com",
    "https://example.com/contacts",
    "https://example.com/about"
  ]
}
```

## Debugging

### Enable Verbose Logging

```python
# В crawl4ai_client.py
BrowserConfig(verbose=True)  # Включить verbose логи
```

### Test Specific Domain

```bash
# Запустить backend в debug режиме
python -c "
import asyncio
from crawl4ai_client import Crawl4AIClient

async def test():
    client = Crawl4AIClient()
    result = await client.crawl_domain('example.com')
    print(result)

asyncio.run(test())
"
```

### Check Crawl4AI Version

```bash
pip show crawl4ai | grep Version
```

Требуется минимум **0.4.0**.

## Performance

### Timing (per domain)

- Homepage crawl: ~2-3 сек
- Contact pages crawl (3 параллельно): ~2-3 сек
- Total per domain: ~4-5 сек
- For 10 domains: ~40-50 сек (параллельно)

### Memory

- Browser instance: ~100-200 MB
- Per page: ~10-50 MB
- Typical for 5 pages: ~200-400 MB

### Optimization Tips

1. Уменьшить `scan_full_page` для больших сайтов
2. Уменьшить `max_pages` для speed
3. Увеличить `max_concurrent` в `arun_many` (будьте аккуратны)
4. Использовать `cache_mode=CacheMode.ENABLED` для repeated crawls

## Future Improvements

- [ ] Кэширование результатов (PostgreSQL)
- [ ] Rate limiting по IP
- [ ] Cookie/Session management
- [ ] Proxy rotation
- [ ] LLM-based extraction (для сложных структур)
- [ ] Webhook notifications
- [ ] Batch processing queue

## Troubleshooting

### "Crawl4AI not installed"

```bash
pip install -U crawl4ai
crawl4ai-setup
```

### "Page timeout"

Увеличить `timeout` в `Crawl4AIClient` или `page_timeout` в `CrawlerRunConfig`.

### "No emails found"

1. Проверить что сайт загружается (проверить result.success)
2. Включить verbose logging
3. Проверить что контактная информация есть на сайте
4. Увеличить `scan_full_page=True`

### "Browser crash"

- Перезагрузить backend
- Проверить свободную память
- Уменьшить `max_concurrent` в `arun_many`

## References

- Crawl4AI GitHub: https://github.com/unclecode/crawl4ai
- Playwright: https://playwright.dev/
- Async Python: https://docs.python.org/3/library/asyncio.html
