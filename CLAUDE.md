# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Обзор репозитория

Монорепозиторий (~40 проектов). Основной бизнес-пайплайн — извлечение и поиск бизнес-лидов из 2ГИС:

```
2GIS (.dgdat) → dgdat2xlsx/convert.py → XLSX (24 колонки)
  → dgdat2xlsx/import_db.py → SQLite (data/local.db, 9 таблиц)
    → dbgis-backend/sync_sqlite_to_postgres.py → PostgreSQL (идентичная структура)
      → dbgis-backend/rebuild_faiss.py → FAISS индекс (category_ids)
        → dbgis-backend/main.py (FastAPI API + Web UI "LeadExtractor")
          → dbgis-backend/enrich.py (обогащение контактов с сайтов)
```

Подробная пошаговая инструкция rebuild: `dbgis-backend/PIPELINE.md`

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

# Тест эндпоинтов (query ≥ 3 символа обязательно)
curl "http://localhost:8000/api/companies?query=кафе&limit=5"
curl "http://localhost:8000/api/companies?query=кафе+в+москве"

# Тест качества поиска (88 запросов, выводит метрики)
python test_search.py

# Обогащение контактов
python enrich.py --status
python enrich.py --continuous --batch-size 200

# Диагностика поиска (5-шаговая проверка pipeline)
python debug_search.py "кафе в москве"
python debug_search.py "автосервис" --company-id 12345

# Пересборка FAISS индекса из PostgreSQL
python rebuild_faiss.py
python rebuild_faiss.py --test-query "кафе"

# Синхронизация SQLite → PostgreSQL (инкрементальный UPSERT)
python sync_sqlite_to_postgres.py

# Полная очистка PostgreSQL (TRUNCATE + VACUUM FULL)
python clean_postgres.py
python clean_postgres.py --force  # без подтверждения
```

### Полный rebuild данных (после исправлений в pipeline)

```bash
cd dgdat2xlsx && python convert.py           # 1. XLSX из 2GIS
rm -f data/local.db && python import_db.py   # 2. SQLite из XLSX
cd ../dbgis-backend
python clean_postgres.py --force             # 3. Очистить PostgreSQL
python sync_sqlite_to_postgres.py            # 4. Синхронизировать данные
python rebuild_faiss.py                      # 5. Пересобрать FAISS
python debug_search.py "автосервис"          # 6. Проверить результат
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

Монолит `main.py` (~1000 строк). Синхронный код, psycopg2 (не asyncpg).

**Схема БД (9 таблиц, идентична в SQLite и PostgreSQL):**
```
cities ──< companies ──< branches ──< phones
               ├──< emails
               ├──< socials
               ├──< company_aliases
               └──< company_categories >── categories (иерархия: parent_id)
```

**Контракт SQLite ↔ PostgreSQL:** структура таблиц идентична. `sync_sqlite_to_postgres.py` делает простой UPSERT из аналогичных таблиц (cities → cities, companies → companies, и т.д.). Не генерировать данные на стороне PostgreSQL — всё приходит из SQLite.

**Критические архитектурные решения (НЕ МЕНЯТЬ без причины):**
- **Двухфазный SQL**: CTE `filtered` (фильтр + сортировка + LIMIT без LATERAL) → ENRICH (LATERAL только для LIMIT строк). 10-50x быстрее старого монолитного запроса
- GIN триграммные индексы (`pg_trgm`) для ILIKE-поиска
- Connection pool через `psycopg2.SimpleConnectionPool` (всегда возвращать через `release_db_connection`)
- In-memory кеш `SimpleCache` с 60с TTL
- `build_filter_clause()` — единственный источник WHERE-условий (используется в `/api/companies` и `/api/export`)
  - Города: OR логика (`city_id = ANY(%s)`)
  - Категории (UI мульти-выбор, `category_filter_ids`): AND логика (`ANY + HAVING COUNT(DISTINCT) = N`)
  - Категории (FAISS поиск, `category_ids`): OR логика (`ANY` без HAVING)
- `_build_enrich_category_filter()` — фильтр категорий в ENRICH-фазе (чтобы STRING_AGG показывал только совпавшие категории)

**Поиск категорий — FAISS (faiss_service.py):**
- Семантический поиск через FAISS + E5 embeddings (`intfloat/multilingual-e5-base`)
- `find_top_categories(query, k=3)` — возвращает top-3 категории, ids объединяются через `set()` → `list[int]`
- `find_category(query)` — legacy, возвращает одну лучшую категорию
- `normalize_query()` — маппинг разговорных запросов ("поесть" → "ресторан кафе")
- Модель и индекс загружаются один раз при импорте модуля (latency < 50ms)
- Файлы индекса: `categories_faiss_e5.index`, `category_mapping_e5.json`
- **КРИТИЧНО: ids в mapping = category_id (НЕ company_id!)**. SQL использует `WHERE cc.category_id = ANY(%s)`. При пересборке через `rebuild_faiss.py` используется `ARRAY_AGG(DISTINCT cat.id)`, не `company_id`

**Парсер запросов — fallback (ai_parser.py):**
- `parse_query_fallback()` — извлекает город и фильтры контактов из текста ("кафе в Москве с телефоном")
- `normalize_city()` — обрезает падежные окончания ("москве" → "москв") для ILIKE-совпадения
- Используется параллельно с FAISS (FAISS → категория, fallback → город/фильтры)

**Детекция города — `detect_city_in_query()`:**
- Находит название города в произвольном тексте ("автосервисы братск" → Братск)
- Результат применяется как **жёсткий фильтр** `parsed_city_ids` (не как подсказка UI)
- Работает без предлога "в" (в отличие от `parse_query_fallback`)

**Каскадный fallback при 0 результатах:**
1. FAISS top-3 category_ids → `WHERE cc.category_id = ANY(%s)`
2. ILIKE по имени категории → `WHERE cat.name ILIKE %s`
3. ILIKE по имени компании → `WHERE c.name ILIKE %s`
4. ILIKE по оригинальному запросу → `WHERE c.name ILIKE %s OR cat.name ILIKE %s`

**Эндпоинты:**
- `GET /api/companies` — список с фильтрами + FAISS-поиск по query (rate limited)
- `GET /api/companies/{id}?token=...` — детали компании (требует HMAC-токен из результатов поиска)
- `GET /api/export` — CSV экспорт (макс. 5000 записей, rate limited)
- `GET /api/cities` — автокомплит городов
- `GET /health` — healthcheck
- `GET /` — Web UI (Jinja2 шаблон)
- `GET /auth/yandex/login` — редирект на Yandex OAuth
- `GET /auth/yandex/callback` — callback, создание пользователя + API key
- `POST /auth/api-key/regenerate` — перегенерация API ключа (требует X-API-Key)
- `GET /auth/me` — информация о текущем пользователе (требует X-API-Key)

**Безопасность API (НЕ ОСЛАБЛЯТЬ):**
- **HMAC-токены**: `/api/companies/{id}` требует `token` — генерируется через `_generate_detail_token(company_id)` при поиске, проверяется через `_verify_detail_token()`. Секрет в `.env` (`DETAIL_TOKEN_SECRET`)
- **Rate limiting**: 30 req/min на IP (in-memory, `_check_rate_limit()`). Применяется к `/api/companies`, `/api/companies/{id}`, `/api/export`
- **MIN_QUERY_LENGTH = 3**: query короче 3 символов → пустой результат (защита от `query="а"`)
- **MAX_OFFSET = 10000**: offset > 10000 → пустой результат (защита от enumeration через пагинацию)
- **MAX_EXPORT_LIMIT = 5000**: CSV экспорт ограничен 5000 записями
- **CSV sanitization**: `_sanitize_csv_value()` добавляет апостроф-префикс к строкам на `=`, `+`, `-`, `@` (защита от CSV injection в Excel)
- **Guard clauses**: пустой запрос без фильтров → пустой результат (frontend + backend)
- **Фронтенд**: кнопка поиска disabled при < 3 символах, `handleSearch()` и `exportCSV()` имеют guard на длину query, фильтры НЕ триггерят автоматический поиск

## Архитектура: dgdat2xlsx

**Бизнес-правило #1: НЕ ТЕРЯТЬ контактную информацию** (сайты, email, телефоны, соцсети).

- `convert.py` (~1200 строк): бинарный парсинг dgdat, нормализация URL, экспорт XLSX (24 фиксированных колонки)
- `import_db.py` (~550 строк): идемпотентный импорт XLSX → SQLite (INSERT OR IGNORE / ON CONFLICT), создаёт таблицу `cities` и проставляет `city_id` в companies
- PostgreSQL использует оригинальные ID из SQLite (не автогенерация)
- **Категории хранятся как полные цепи (section→subsection→rubric)**, обрабатываются row-by-row через zip. НЕ через вложенные циклы — иначе Декартово произведение (3×5×10=150 вместо 10 категорий)

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

## Авторизация: Yandex OAuth + API keys (auth.py)

**Изоляция через PostgreSQL-схему `auth`** — данные пользователей полностью отделены от бизнес-данных (`public`).

**Почему schema isolation защищает от cleaner/sync:**
- `clean_postgres.py` — TRUNCATE только по имени таблицы (`TRUNCATE TABLE phones CASCADE`), без указания схемы → default `public`. Проверка `_table_exists()` фильтрует по `table_schema = 'public'`
- `sync_sqlite_to_postgres.py` — все INSERT/UPSERT по неквалифицированным именам → default `public`
- `VACUUM FULL` и `ANALYZE` на конкретных таблицах из `TRUNCATE_ORDER` — все в `public`
- **Ни одна операция не касается схемы `auth`**

**Архитектура:**
- `auth.py` — отдельный модуль (не в монолите `main.py`): OAuth flow, API key CRUD, middleware
- Таблицы: `auth.users` (UUID PK, external_id, plan, credits), `auth.api_keys` (key_hash SHA-256, is_active)
- **Shadow mode**: middleware `AuthMiddleware` читает `X-API-Key` из заголовка. Если ключ отсутствует — запрос пропускается (request.state.user = None). Если ключ невалиден — 401
- `get_current_user(request)` — helper для чтения пользователя из request.state
- API key возвращается raw ОДИН раз (при создании), хранится только SHA-256 хэш
- `init_auth_schema()` — идемпотентное создание таблиц при старте (CREATE IF NOT EXISTS)

**Env vars для auth:**

| Переменная | Default | Описание |
|------------|---------|----------|
| `YANDEX_CLIENT_ID` | (пусто) | ID приложения Yandex OAuth |
| `YANDEX_CLIENT_SECRET` | (пусто) | Секрет приложения Yandex OAuth |
| `AUTH_CALLBACK_URL` | http://localhost:8000/auth/yandex/callback | URL для OAuth callback |

## Утилиты управления данными (dbgis-backend)

| Скрипт | Назначение |
|--------|-----------|
| `sync_sqlite_to_postgres.py` | Инкрементальный UPSERT из SQLite → PostgreSQL. Порядок: cities → companies → branches → phones → emails → socials → categories → company_categories → company_aliases. IS DISTINCT FROM для skip-update |
| `rebuild_faiss.py` | Пересборка FAISS индекса из PostgreSQL. Хранит **category_id** (не company_id!) |
| `debug_search.py` | 5-шаговая диагностика: FAISS → PostgreSQL categories → companies → реальные категории → детальная проверка |
| `clean_postgres.py` | TRUNCATE всех таблиц (в порядке FK), сброс sequences, VACUUM FULL + ANALYZE |

**Контракт FAISS ↔ SQL (НЕ НАРУШАТЬ):**
```
rebuild_faiss.py: SELECT ARRAY_AGG(DISTINCT cat.id) → mapping.ids = [category_id, ...]
faiss_service.py: find_top_categories() → {"name": "...", "ids": [category_id, ...]}
main.py:          WHERE cc.category_id = ANY(%s)  ← ids из FAISS
```

## Переменные окружения (.env) для dbgis-backend

| Переменная | Default | Описание |
|------------|---------|----------|
| `DB_HOST` | localhost | PostgreSQL хост |
| `DB_PORT` | 5432 | PostgreSQL порт |
| `DB_NAME` | dbgis | Имя БД |
| `DB_USER` | postgres | Пользователь БД |
| `DB_PASSWORD` | postgres | Пароль БД |
| `DB_POOL_MIN` | 2 | Мин. соединений в пуле |
| `DB_POOL_MAX` | 10 | Макс. соединений в пуле |
| `DETAIL_TOKEN_SECRET` | random (при старте) | HMAC-секрет для токенов доступа к деталям. **В production обязателен в .env** |
| `API_HOST` | 0.0.0.0 | Хост для прослушивания |
| `API_PORT` | 8000 | Порт API |
| `DEBUG` | False | Подробные логи + `/api/debug/explain` |

## Общие правила

- Язык комментариев и вывода: **русский**
- Минимум зависимостей — не добавлять pandas, sqlalchemy, ORM
- Параметризованные SQL-запросы (никогда f-string в SQL)
- `decode_punycode_domain()` — вызывать везде где отдаются домены (3 места: list, detail, export)
- Vanilla JS в UI dbgis-backend (без React/Vue), встроенный CSS + Tailwind для базовых стилей
- Не создавать отдельные файлы для маршрутов/моделей в dbgis-backend — монолит `main.py`
- Идемпотентность: INSERT OR IGNORE / ON CONFLICT во всех DB-операциях
- Контактная информация не должна теряться ни на одном этапе пайплайна
- Не ослаблять security guard-ы (MIN_QUERY_LENGTH, MAX_OFFSET, HMAC-токены, rate limiting)
