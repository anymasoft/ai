# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Обзор репозитория

Монорепозиторий (~40 проектов). Основной бизнес-пайплайн — извлечение и поиск бизнес-лидов из 2ГИС:

```
2GIS (.dgdat) → dgdat2xlsx/convert.py → XLSX (24 колонки)
  → dgdat2xlsx/import_db.py → SQLite (data/local.db)
    → dbgis-backend/migrate_sqlite_to_postgres.py → PostgreSQL (8 таблиц)
      → dbgis-backend/main.py (FastAPI API + Web UI "LeadExtractor")
        → dbgis-backend/enrich.py (обогащение контактов с сайтов)
```

Каждый подпроект имеет свой `CLAUDE.md` с детальными правилами — **обязательно читай перед работой**.

## Ключевые проекты

| Проект | Назначение | Стек |
|--------|-----------|------|
| `dbgis-backend/` | FastAPI backend + Web UI для поиска компаний | FastAPI, PostgreSQL, psycopg2, FAISS, Jinja2, Vanilla JS |
| `dgdat2xlsx/` | Парсинг бинарных 2GIS файлов → XLSX → SQLite | Python stdlib + openpyxl |
| `EXTRACTOR/` | Мульти-источниковый поиск лидов (DuckDuckGo, 2GIS, SearXNG) | Python, pymorphy2 |
| `LeadExtractor/` | Извлечение контактов с сайтов (Crawl4AI) | Python, FastAPI, React |
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

# Тест качества поиска (88 запросов, выводит метрики)
python test_search.py

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
pnpm dev                        # Запуск dev-сервера (порт 3010)
bunx vitest run 'path/to/test'  # Запуск одного теста
pnpm lint                       # Линтинг
pnpm type-check                 # Проверка типов
pnpm db:migrate                 # Миграции БД (Drizzle)
# НЕ запускать pnpm test (10+ мин). НЕ запускать pnpm i18n (CI делает это).
```

## Архитектура: dbgis-backend

Монолит `main.py` (~780 строк). Синхронный код, psycopg2 (не asyncpg).

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

**Поиск категорий — FAISS (faiss_service.py):**
- Семантический поиск через FAISS + E5 embeddings (`intfloat/multilingual-e5-base`)
- `find_top_categories(query, k=3)` — возвращает top-3 категории, ids объединяются через `set()` → `list[int]`
- `find_category(query)` — legacy, возвращает одну лучшую категорию
- `normalize_query()` — маппинг разговорных запросов ("поесть" → "ресторан кафе")
- Модель и индекс загружаются один раз при импорте модуля (latency < 50ms)
- Файлы индекса: `categories_faiss_e5.index`, `category_mapping_e5.json`

**Парсер запросов — fallback (ai_parser.py):**
- `parse_query_fallback()` — извлекает город и фильтры контактов из текста ("кафе в Москве с телефоном")
- `normalize_city()` — обрезает падежные окончания ("москве" → "москв") для ILIKE-совпадения
- Используется параллельно с FAISS (FAISS → категория, fallback → город/фильтры)

**Каскадный fallback при 0 результатах:**
1. FAISS top-3 category_ids → `WHERE cc.category_id = ANY(%s)`
2. ILIKE по имени категории → `WHERE cat.name ILIKE %s`
3. ILIKE по имени компании → `WHERE c.name ILIKE %s`
4. ILIKE по оригинальному запросу → `WHERE c.name ILIKE %s OR cat.name ILIKE %s`

**Эндпоинты:**
- `GET /api/companies` — список с фильтрами + FAISS-поиск по query
- `GET /api/companies/{id}` — детали компании
- `GET /api/export` — CSV экспорт (до 50k)
- `GET /health` — healthcheck
- `GET /` — Web UI (Jinja2 шаблон)

## Архитектура: dgdat2xlsx

**Бизнес-правило #1: НЕ ТЕРЯТЬ контактную информацию** (сайты, email, телефоны, соцсети).

- `convert.py` (~1200 строк): бинарный парсинг dgdat, нормализация URL, экспорт XLSX (24 фиксированных колонки)
- `import_db.py` (~550 строк): идемпотентный импорт XLSX → SQLite (INSERT OR IGNORE / ON CONFLICT)
- PostgreSQL использует оригинальные ID из SQLite (не автогенерация)

**Нормализация URL:** развёртывание обёрток 2GIS, удаление UTM, дедупликация по домену. `.lower()` только для доменов и email, НЕ для полных URL.

## Архитектура: EXTRACTOR

Поиск лидов из внешних источников. Используется как библиотека из `dbgis-backend/enrich.py`.

```
query.txt ("ниша в город")
  → search_duckduckgo.py (DuckDuckGo/Google/SearXNG)
  → PARSER/search_2gis.py (2GIS native через parser-2gis)
    → crawler_filter.py (фильтрация агрегаторов: zoon, flamp, yandex и т.д.)
      → extractor_final.py (извлечение email/phone из HTML)
```

**Не рефакторить** `extractor_final.py` и `crawler_filter.py` — они импортируются из `enrich.py` как есть.

## Архитектура: LeadExtractor

Извлечение контактов с сайтов через BFS-краулинг (Crawl4AI).

- `backend/crawl4ai_client.py` (~2000 строк) — основной движок: 6 проходов извлечения (structured → heuristic → aggressive)
- `backend/phone_normalizer.py` — валидация и нормализация телефонов
- `backend/main.py` — FastAPI: `POST /api/extract`, `GET /api/health`
- `frontend/` — React 18 + Vite + Tailwind

## Архитектура: lobehub

LobeChat — форк AI-чата. Монорепо с pnpm workspaces.

- **Framework:** Next.js 16 + React 19 + TypeScript
- **State:** Zustand, **Data:** SWR + tRPC, **DB:** Drizzle ORM + PostgreSQL
- **UI:** Ant Design + @lobehub/ui + antd-style (CSS-in-JS)
- **Тесты:** Vitest (unit), Playwright (E2E). Предпочитать `vi.spyOn` вместо `vi.mock`
- **Ветки:** `canary` (dev) → `main` (release). Git pull через rebase

## Общие правила

- Язык комментариев и вывода: **русский**
- Минимум зависимостей — не добавлять pandas, sqlalchemy, ORM
- Параметризованные SQL-запросы (никогда f-string в SQL)
- `decode_punycode_domain()` — вызывать везде где отдаются домены (3 места: list, detail, export)
- Vanilla JS в UI dbgis-backend (без React/Vue), встроенный CSS + Tailwind для базовых стилей
- Не создавать отдельные файлы для маршрутов/моделей в dbgis-backend — монолит `main.py`
- Идемпотентность: INSERT OR IGNORE / ON CONFLICT во всех DB-операциях
- Контактная информация не должна теряться ни на одном этапе пайплайна
