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
