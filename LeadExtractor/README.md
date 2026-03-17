# Lead Extractor

Backend MVP сервис для извлечения контактов (email, телефоны) с веб-сайтов.

## Стек технологий

- Python 3.12, FastAPI, PostgreSQL, Redis, Celery, Crawl4AI, phonenumbers

## Быстрый старт

```bash
cd LeadExtractor
docker-compose up --build
```

API: http://localhost:8000
Docs: http://localhost:8000/docs

## API Endpoints

### POST /extract
```json
{"domains": ["example.com", "site.com"]}
```

### GET /leads?job_id=<uuid>&domain=<domain>

## База данных

Таблица `leads`: id, domain, email, phone, source_page, job_id, created_at

## Ограничения

- Максимум 5 страниц на домен
- Timeout 15 секунд
- Retry при ошибках (до 3 попыток)
