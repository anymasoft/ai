# CLAUDE.md — dbgis-backend

## Проект
FastAPI backend для поиска и фильтрации компаний из 2ГИС.
PostgreSQL + psycopg2 + Jinja2 + Vanilla JS.

## Структура
```
dbgis-backend/
├── main.py                    # FastAPI-приложение (все эндпоинты)
├── schema.sql                 # DDL: таблицы + индексы (включая pg_trgm)
├── migrate_sqlite_to_postgres.py  # Миграция из SQLite → PostgreSQL
├── migrations/                # SQL-миграции
├── templates/                 # Jinja2 HTML-шаблоны
├── requirements.txt
├── setup.sh / setup.bat
└── CLAUDE.md
```

## Команды
```bash
# Запуск
python main.py                  # uvicorn на API_HOST:API_PORT
# или
uvicorn main:app --reload       # dev-режим

# Зависимости
pip install -r requirements.txt

# Миграция БД
psql -d dbgis -f schema.sql
python migrate_sqlite_to_postgres.py
```

## Архитектура API

### Эндпоинты
| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/companies` | Список компаний (фильтры, пагинация) |
| GET | `/api/companies/{id}` | Детали компании |
| GET | `/api/export` | CSV-экспорт |
| GET | `/api/debug/explain` | EXPLAIN ANALYZE (только DEBUG) |
| GET | `/health` | Healthcheck |
| GET | `/` | Web UI |

### Лимиты
- `/api/companies`: max limit = **1000**
- `/api/export`: max limit = **50000**

## Схема БД
```
companies ──< branches ──< phones
    │
    ├──< emails
    ├──< socials
    └──< company_categories >── categories
```

## Критические решения (performance)

### 1. LATERAL JOIN вместо коррелированных подзапросов
**Проблема**: 4 подзапроса в SELECT = O(N) дополнительных запросов.
**Решение**: `LEFT JOIN LATERAL (...) ON TRUE` — PostgreSQL оптимизирует как обычный JOIN.
**Файл**: `main.py`, константа `COMPANIES_LIST_SQL`.

### 2. DISTINCT убран
**Проблема**: LEFT JOIN categories умножает строки → нужен DISTINCT (сортировка + dedup).
**Решение**: GROUP BY включает все LATERAL-поля → строки уникальны без DISTINCT.

### 3. GIN pg_trgm индексы для ILIKE
**Проблема**: `WHERE city ILIKE '%москва%'` = Seq Scan 100k строк.
**Решение**: `CREATE INDEX ... USING GIN (city gin_trgm_ops)` — Bitmap Index Scan, 10-50x быстрее.
**Файл**: `schema.sql`, строки 97-101.
**Требует**: `CREATE EXTENSION IF NOT EXISTS pg_trgm;`

### 4. Connection Pool
**Проблема**: `psycopg2.connect()` = новое TCP-соединение (~5ms) на каждый запрос.
**Решение**: `psycopg2.pool.SimpleConnectionPool(2, 10)` — переиспользование соединений.
**Конфиг**: env `DB_POOL_MIN` (default 2), `DB_POOL_MAX` (default 10).

### 5. In-memory кеш
**Класс**: `SimpleCache` в `main.py`.
**TTL**: 60 секунд (без Redis, без зависимостей).
**Ключ**: MD5 от отсортированных query params.
**Покрытие**: `/api/companies` (самый частый запрос).

### 6. Фильтры вынесены в `build_filter_clause()`
**Зачем**: один источник правды для WHERE-условий (data + count).
**Было**: дублирование фильтров в 2 местах → рассинхрон и баги.

## Индексы (schema.sql)

### B-tree (FK/JOIN)
- `companies(name)`, `companies(domain)`
- `branches(company_id)`, `phones(branch_id)`
- `emails(company_id)`, `socials(company_id)`
- `company_categories(company_id)`, `company_categories(category_id)`
- `categories(parent_id)`, `categories(name)`

### GIN триграммные (ILIKE)
- `companies(city gin_trgm_ops)`
- `categories(name gin_trgm_ops)`

## Env-переменные
| Переменная | Default | Описание |
|------------|---------|----------|
| DB_HOST | localhost | Хост PostgreSQL |
| DB_PORT | 5432 | Порт PostgreSQL |
| DB_NAME | dbgis | Имя БД |
| DB_USER | postgres | Пользователь |
| DB_PASSWORD | postgres | Пароль |
| DB_POOL_MIN | 2 | Мин. соединений в пуле |
| DB_POOL_MAX | 10 | Макс. соединений в пуле |
| API_HOST | 0.0.0.0 | Хост API |
| API_PORT | 8000 | Порт API |
| DEBUG | False | Режим отладки (включает /api/debug/explain) |

## Правила для Claude Code

### Качество кода
- Не добавлять Redis, очереди, async магию — проект намеренно простой
- psycopg2 (синхронный) — осознанный выбор, не менять на asyncpg
- Все SQL-запросы — параметризованные (%s), никогда f-string
- Connection pool обязателен — не возвращаться к `psycopg2.connect()` напрямую
- LATERAL JOIN — не менять обратно на коррелированные подзапросы

### Экономия токенов
- Фильтры строятся через `build_filter_clause()` — не дублировать
- SQL-шаблоны в константах (`COMPANIES_LIST_SQL`, `COMPANIES_COUNT_SQL`)
- Утилиты (`decode_rows`, `decode_punycode_domain`) переиспользовать
- Не создавать отдельные файлы для роутов/моделей — всё в `main.py` (монолит)

---

## Полный pipeline системы

```
2GIS (.dgdat) → dgdat2xlsx/convert.py → XLSX
  → dgdat2xlsx/import_db.py → SQLite (data/local.db)
    → dbgis-backend/migrate_sqlite_to_postgres.py → PostgreSQL
      → dbgis-backend/main.py (FastAPI API + Web UI)
        → dbgis-backend/enrich.py (обогащение контактов)
```

### Связанные проекты
| Проект | Путь | Назначение |
|--------|------|------------|
| dgdat2xlsx | `../dgdat2xlsx/` | Парсинг 2ГИС .dgdat → XLSX → SQLite |
| EXTRACTOR | `../EXTRACTOR/` | Исходный код extractor (только для ознакомления) |
| dbgis-backend | `.` (текущий) | FastAPI API + PostgreSQL + Web UI + enrich |

---

## Enrichment — система обогащения контактов

### Структура
```
dbgis-backend/
  enrichment/
    __init__.py
    crawler.py      # get_relevant_links(domain) → list[str]
    extractor.py    # extract_contacts(html) → {"emails": [], "phones": []}
  enrich.py         # CLI orchestrator (cron/ручной запуск)
  logs/
    enrich.log      # лог работы enrichment
  migrations/
    001_enrichment.sql  # ALTER TABLE companies ADD enrichment_status, enriched_at
```

### Поля БД (добавлены миграцией 001)
```sql
companies.enrichment_status  TEXT DEFAULT 'pending'
  -- pending | processing | done | failed

companies.enriched_at        TIMESTAMP
  -- дата успешного обогащения
```

### Pipeline обогащения одной компании
```
SELECT companies WHERE enrichment_status IN ('pending','failed') AND domain IS NOT NULL
  → UPDATE enrichment_status = 'processing'
    → crawler.py: domain → top-5 URLs (homepage + контактные страницы)
      → fetch_url каждой страницы (urllib, timeout=15, max 5MB)
        → extractor.py: HTML → {"emails": [], "phones": []}
          → INSERT INTO emails (ON CONFLICT DO NOTHING)
          → INSERT INTO phones → первый branch или виртуальный 'enriched'
            → UPDATE enrichment_status = 'done' / 'failed'
```

### Resume-логика (перезапуск после сбоя)
1. При старте: зависшие `processing` → `failed` (crash recovery)
2. SELECT только `pending` и `failed` — уже `done` не трогаются
3. `--start` флаг: сброс всех в `pending` (начать заново)

### Запуск enrich.py
```bash
python enrich.py                     # батч 100 компаний
python enrich.py --batch-size 500    # другой размер батча
python enrich.py --company-id 12345  # одна компания
python enrich.py --status            # статистика
python enrich.py --start             # сброс в pending + запуск

# Cron (каждые 30 минут):
*/30 * * * * cd /path/to/dbgis-backend && python enrich.py --batch-size 200 >> logs/enrich.log 2>&1
```

### API endpoints обогащения
| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/api/enrich/start` | Запустить enrich.py (background subprocess) |
| GET | `/api/enrich/status` | Статистика: total/pending/processing/done/failed/progress_percent |

`POST /api/enrich/start` параметры:
- `batch_size` (int, default 100) — размер батча
- `reset` (bool, default false) — сбросить все в pending перед запуском

### UI: прогресс-бар и auto-refresh
- **Прогресс-бар**: polling `/api/enrich/status` каждые **2 сек**
- **Таблица**: polling `/api/companies` каждые **5 сек** (если был активный поиск)
- **Кнопка "Обогатить"**: `POST /api/enrich/start`
- **Кнопка "Заново"**: `POST /api/enrich/start?reset=true`
- Кнопка блокируется пока `is_running=true` (processing > 0)

### Виртуальный филиал для enriched телефонов
Телефоны в БД привязаны к `branch_id`. Enrichment:
1. Ищет первый существующий `branch` для компании
2. Если нет ни одного — создаёт виртуальный: `address='enriched'`, `branch_hash=MD5('enriched_{id}')`
3. `INSERT INTO phones ON CONFLICT DO NOTHING`

### Идемпотентность
- `INSERT INTO emails ... ON CONFLICT DO NOTHING`
- `INSERT INTO phones ... ON CONFLICT DO NOTHING`
- `INSERT INTO branches ... ON CONFLICT (branch_hash) DO NOTHING`
- Повторный запуск не создаёт дублей

### Производительность
- `ThreadPoolExecutor(max_workers=5)` — параллельный обход
- `DELAY_BETWEEN_SITES = 0.5 сек` — пауза между сайтами
- Расчётная скорость: ~14,000 компаний/день
- Timeout HTTP: 15 сек, лимит ответа: 5 МБ

### Применить миграцию
```bash
psql -d dbgis -f migrations/001_enrichment.sql
```

---

## Полный pipeline системы

```
2GIS (.dgdat) → dgdat2xlsx/convert.py → XLSX
  → dgdat2xlsx/import_db.py → SQLite (data/local.db)
    → dbgis-backend/migrate_sqlite_to_postgres.py → PostgreSQL
      → dbgis-backend/main.py (FastAPI API + Web UI)
        → dbgis-backend/enrich.py (ПЛАНИРУЕТСЯ: обогащение контактов)
```

### Связанные проекты
| Проект | Путь | Назначение |
|--------|------|------------|
| dgdat2xlsx | `../dgdat2xlsx/` | Парсинг 2ГИС .dgdat → XLSX → SQLite |
| EXTRACTOR | `../EXTRACTOR/` | Извлечение контактов с сайтов (email, phone) |
| dbgis-backend | `.` (текущий) | FastAPI API + PostgreSQL + Web UI |

## Enrichment (обогащение) — ПЛАН ИНТЕГРАЦИИ

### Архитектура
`enrich.py` — CLI-скрипт (cron/ручной запуск), НЕ сервис.
Импортирует `extractor_final.py` и `crawler_filter.py` из `../EXTRACTOR/`.

### Pipeline обогащения
```
PostgreSQL: SELECT companies WHERE enrichment_status='pending' AND domain IS NOT NULL
  → crawler_filter: domain → top-5 relevant URLs (contacts, about, homepage)
    → extractor_final: HTML → phones + emails
      → INSERT INTO emails/phones (ON CONFLICT DO NOTHING)
        → UPDATE companies SET enrichment_status='done'
```

### Новые поля в companies
```sql
enrichment_status TEXT DEFAULT 'pending'  -- pending|processing|done|failed|skip
enriched_at TIMESTAMP
enrichment_attempts INTEGER DEFAULT 0
```

### Новая таблица enrichment_log
```sql
CREATE TABLE enrichment_log (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id),
    started_at TIMESTAMP, finished_at TIMESTAMP,
    status TEXT,  -- ok|error|timeout|blocked
    pages_crawled INTEGER, emails_found INTEGER, phones_found INTEGER,
    error_message TEXT, source TEXT DEFAULT 'website'
);
```

### Ключевые решения
- **domain** (не website) — точка входа для crawler (чистый, нормализованный)
- **Виртуальный филиал** для enriched phones: `branches(address='enriched')`
- **FOR UPDATE SKIP LOCKED** — безопасный параллельный запуск
- **ThreadPoolExecutor(5)** — ~14,400 компаний/день
- **Max 3 попытки** на компанию, таймаут 15 сек на HTTP
- **HTML НЕ хранить** (только tmp-кеш для debug)

### API endpoints (планируются)
```
POST /api/enrich/start    — запуск subprocess enrich.py
GET  /api/enrich/status   — статистика по enrichment_status
```

### Cron
```bash
*/30 * * * * cd /path/to/dbgis-backend && python enrich.py --batch-size 200 >> logs/enrich.log 2>&1
```
