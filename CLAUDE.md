# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Обзор репозитория

Монорепозиторий с множеством проектов. Основной бизнес-пайплайн — извлечение и поиск бизнес-лидов из 2ГИС:

```
2GIS (.dgdat) → dgdat2xlsx/convert.py → XLSX
  → dgdat2xlsx/import_db.py → SQLite (data/local.db)
    → dbgis-backend/migrate_sqlite_to_postgres.py → PostgreSQL
      → dbgis-backend/main.py (FastAPI API + Web UI "LeadExtractor")
        → dbgis-backend/enrich.py (обогащение контактов с сайтов)
```

Каждый подпроект имеет свой `CLAUDE.md` с детальными правилами — **обязательно читай перед работой**.

## Ключевые проекты

| Проект | Назначение | Стек |
|--------|-----------|------|
| `dbgis-backend/` | FastAPI backend + Web UI для поиска компаний | FastAPI, PostgreSQL, psycopg2, Jinja2, Vanilla JS |
| `dgdat2xlsx/` | Парсинг бинарных 2GIS файлов → XLSX → SQLite | Python stdlib + openpyxl |
| `EXTRACTOR/` | Мульти-источниковый поиск лидов (DuckDuckGo, 2GIS, SearXNG) | Python, pymorphy2 |
| `LeadExtractor/` | Извлечение контактов с сайтов (Crawl4AI) | Python, FastAPI |
| `lobehub/` | LobeChat — AI-чат (форк) | Next.js 16, React 19, TypeScript |

## Команды для разработки

### dbgis-backend (основной backend)

```bash
cd dbgis-backend

# Установка
pip install -r requirements.txt

# Запуск (dev)
python main.py
# или с автоперезагрузкой:
uvicorn main:app --reload

# Запуск с отладкой
DEBUG=True python main.py

# Проверка здоровья
curl http://localhost:8000/health

# Тест эндпоинтов
curl "http://localhost:8000/api/companies?limit=5"
curl "http://localhost:8000/api/companies?query=кафе+в+москве"

# Обогащение контактов
python enrich.py --status
python enrich.py --continuous --batch-size 200
```

### dgdat2xlsx (конвертер данных)

```bash
cd dgdat2xlsx

pip install -r requirements.txt

# Конвертация dgdat → xlsx
python convert.py

# Импорт xlsx → sqlite
python import_db.py

# Диагностика типов контактов
python debug_contacts.py
```

### lobehub

```bash
cd lobehub

pnpm install
pnpm dev          # Запуск dev-сервера
pnpm test         # Запуск тестов (vitest)
pnpm lint         # Линтинг
pnpm type-check   # Проверка типов
```

## Архитектура: dbgis-backend

Монолит `main.py` (~700 строк). Синхронный код, psycopg2 (не asyncpg).

**Схема БД (8 таблиц):**
```
companies ──< branches ──< phones
    ├──< emails
    ├──< socials
    ├──< company_aliases
    └──< company_categories >── categories (иерархия: parent_id)
```

**Критические архитектурные решения (НЕ МЕНЯТЬ без причины):**
- LATERAL JOIN в `COMPANIES_LIST_SQL` вместо коррелированных подзапросов (10-50x быстрее)
- GIN триграммные индексы (`pg_trgm`) для ILIKE-поиска
- Connection pool через `psycopg2.SimpleConnectionPool` (всегда возвращать через `release_db_connection`)
- In-memory кеш `SimpleCache` с 60с TTL
- `build_filter_clause()` — единственный источник WHERE-условий (используется в `/api/companies` и `/api/export`)

**AI-категоризация запросов (ai_parser.py):**
- Flat-архитектура: запрос → сразу leaf-категория из БД (parent_id IS NOT NULL)
- LLM используется как **классификатор по списку**, не генератор
- Мягкая фильтрация (убрать товарные категории) → LLM выбирает одну → retry со strict-промптом
- Каскадный fallback: exact ID → ILIKE по категории → ILIKE по имени компании → ILIKE по оригинальному запросу
- Тестирование: `python test_search.py` (88 запросов)

**Эндпоинты:**
- `GET /api/companies` — список с фильтрами + AI-парсинг query
- `GET /api/companies/{id}` — детали компании
- `GET /api/export` — CSV экспорт (до 50k)
- `GET /health` — healthcheck

## Архитектура: dgdat2xlsx

**Бизнес-правило #1: НЕ ТЕРЯТЬ контактную информацию** (сайты, email, телефоны, соцсети).

- `convert.py` (~1200 строк): бинарный парсинг dgdat, нормализация URL, экспорт XLSX (24 фиксированных колонки)
- `import_db.py` (~550 строк): идемпотентный импорт XLSX → SQLite (INSERT OR IGNORE / ON CONFLICT)
- PostgreSQL использует оригинальные ID из SQLite (не автогенерация)

**Нормализация URL:** развёртывание обёрток 2GIS, удаление UTM, дедупликация по домену. `.lower()` только для доменов и email, НЕ для полных URL.

## Общие правила

- Язык комментариев и вывода: **русский**
- Минимум зависимостей — не добавлять pandas, sqlalchemy, ORM
- Параметризованные SQL-запросы (никогда f-string в SQL)
- `decode_punycode_domain()` — вызывать везде где отдаются домены (3 места: list, detail, export)
- Vanilla JS в UI (без React/Vue), встроенный CSS + Tailwind для базовых стилей
