# Lead Extractor

Backend MVP сервис для извлечения контактов (email, телефоны) с веб-сайтов.

## Стек

- Python 3.12, FastAPI, PostgreSQL, Redis, Celery, Crawl4AI, phonenumbers

## Установка и запуск

### 1. Установка зависимостей

```bash
cd LeadExtractor/backend
pip install -r requirements.txt
```

### 2. Установка Playwright браузера

```bash
playwright install --with-deps chromium
```

### 3. Запуск Redis и PostgreSQL

Установите и запустите Redis и PostgreSQL на вашем компьютере.

Создайте базу данных `lead_extractor` в PostgreSQL.

### 4. Запуск API

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 5. Запуск Celery Worker (в отдельном терминале)

```bash
cd backend
celery -A tasks.celery_app worker --loglevel=info
```

## API

Откройте в браузере: http://localhost:8000/docs

### POST /extract
```json
{"domains": ["example.com", "site.com"]}
```

### GET /leads
Query параметры: `job_id`, `domain`

### GET /health
Проверка работы сервиса.

## База данных

Таблица `leads`: id, domain, email, phone, source_page, job_id, created_at

## Ограничения

- Максимум 5 страниц на домен
- Timeout 15 секунд
- Retry при ошибках (до 3 попыток)
