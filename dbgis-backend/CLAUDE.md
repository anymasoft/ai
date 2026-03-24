# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

# dbgis-backend — FastAPI поиск компаний из 2ГИС

**Стек**: FastAPI + PostgreSQL + Vanilla JS (Tailwind) + Jinja2
**Минимум зависимостей**, синхронный код, простая архитектура.

## 🚀 Команды для разработки

### Установка и первый запуск
```bash
# 1. Установить зависимости
pip install -r requirements.txt

# 2. Создать и настроить БД
psql -U postgres -f schema.sql
# или для существующей БД:
python sync_sqlite_to_postgres.py

# 3. Создать .env (на основе примера)
cp .env.example .env
# Отредактировать .env с параметрами PostgreSQL

# 4. Запустить сервер
python main.py
# или с автоперезагрузкой:
uvicorn main:app --reload
```

### Development
```bash
# Запуск с DEBUG=True для логирования ошибок
DEBUG=True python main.py

# Проверка здоровья API
curl http://localhost:8000/health

# Тестировать эндпоинты (примеры)
curl "http://localhost:8000/api/companies?limit=5"
curl "http://localhost:8000/api/companies/1"

# Скачать CSV (первые 100 компаний)
curl "http://localhost:8000/api/export?limit=100" > export.csv
```

### Обогащение контактов (enrichment)
```bash
# Один батч 100 компаний
python enrich.py

# Непрерывный режим до конца всех pending
python enrich.py --continuous

# Другой размер батча
python enrich.py --batch-size 500 --continuous

# Один конкретный company
python enrich.py --company-id 12345

# Статистика обогащения
python enrich.py --status

# Сброс всех в pending + запуск
python enrich.py --start --continuous

# Cron (каждые 30 минут)
*/30 * * * * cd /path/to/dbgis-backend && python enrich.py --batch-size 200 >> logs/enrich.log 2>&1
```

### PostgreSQL операции
```bash
# Подключиться к БД
psql -U postgres -d dbgis

# Основные проверки (в psql):
SELECT COUNT(*) FROM companies;
SELECT COUNT(*) FROM categories;
SELECT COUNT(*) FROM phones WHERE source = 'enrichment';

# Проверить индексы
\d companies

# Проверить миграции (если есть table)
SELECT * FROM schema_migrations;
```

---

## 📐 Архитектура проекта

### Файловая структура
```
dbgis-backend/
├── main.py                        # FastAPI приложение (614 строк)
│   ├── GET /health               # Healthcheck
│   ├── GET / (Web UI)             # Jinja2 шаблон index.html
│   ├── GET /api/companies         # Список (фильтры + пагинация)
│   ├── GET /api/companies/{id}    # Детали компании
│   ├── GET /api/export            # CSV экспорт
│   ├── POST /api/enrich/start     # Запуск обогащения
│   ├── GET /api/enrich/status     # Статус обогащения
│   └── POST /api/enrich/stop      # Остановка обогащения
│
├── enrich.py                      # CLI для обогащения контактов (22 KБ)
│   ├── Парсинг аргументов (--batch-size, --continuous, --start)
│   ├── Управление батчами
│   ├── Логирование в logs/enrich.log
│   └── Статус обогащения
│
├── enrichment/                    # Подмодуль обогащения
│   ├── __init__.py
│   ├── crawler.py                 # get_relevant_links(domain) → URL[]
│   └── extractor.py               # extract_contacts(html) → {emails, phones}
│
├── templates/
│   └── index.html                 # SaaS UI (LeadExtractor)
│
├── schema.sql                     # DDL (таблицы + индексы)
├── sync_sqlite_to_postgres.py     # Инкрементальный UPSERT SQLite → PostgreSQL
├── rebuild_faiss.py               # Пересборка FAISS индекса из PostgreSQL
├── debug_search.py                # 5-шаговая диагностика поиска
├── clean_postgres.py              # TRUNCATE + VACUUM FULL всей БД
├── requirements.txt               # Зависимости (15 пакетов)
│
├── README.md                      # Полная документация
├── CLAUDE.md                      # Этот файл
├── CRITICAL_FIXES.md              # История критических исправлений
├── MIGRATION_GUIDE.md             # Как мигрировать данные
└── UI_IMPROVEMENTS.md             # История улучшений интерфейса
```

### Схема БД (8 таблиц)
```
companies ──< branches ──< phones
    │
    ├──< emails
    ├──< socials
    ├──< company_aliases
    └──< company_categories >── categories
```

**Ключевые поля в companies:**
- `id`, `name`, `city`, `domain`, `website`
- `enrichment_status` (pending|processing|done|failed)
- `enriched_at` (TIMESTAMP)
- `created_at`

### Pipeline данных
```
2GIS .dgdat → dgdat2xlsx/convert.py → XLSX
  → dgdat2xlsx/import_db.py → SQLite
    → dbgis-backend/sync_sqlite_to_postgres.py → PostgreSQL
      → dbgis-backend/rebuild_faiss.py → FAISS индекс
        → main.py (Web + API)
          → enrich.py (обогащение контактов)
```

---

## 🎯 Текущее состояние (Mars 2026)

### ✅ Реализовано
- ✅ FastAPI backend с REST API (все эндпоинты работают)
- ✅ PostgreSQL с оптимизированными запросами (LATERAL JOIN, GIN индексы)
- ✅ Web UI переделан в SaaS стиль (**LeadExtractor**)
- ✅ AI-парсер поискового запроса (распознаёт фильтры из текста)
- ✅ CSV экспорт (до 50k записей)
- ✅ Обогащение контактов (enrich.py)
- ✅ Декодирование кириллических доменов (punycode → русский)
- ✅ Исправлены все JS ошибки в UI

### 🔄 В разработке
- 🔄 Фронтенд продолжает развиваться (улучшения UX, анимации)

### 📋 Идеи для будущего
- [ ] Redis кеширование
- [ ] JWT аутентификация
- [ ] История поисков
- [ ] Сохранённые фильтры
- [ ] Телеграм интеграция

---

## 🔥 Критические архитектурные решения

### 1. LATERAL JOIN вместо коррелированных подзапросов
**Где**: `main.py`, константа `COMPANIES_LIST_SQL`
**Проблема**: 4 подзапроса в SELECT = O(N) доп. запросов к БД
**Решение**: `LEFT JOIN LATERAL (...) ON TRUE`
**Результат**: PostgreSQL оптимизирует как обычный JOIN, 10-50x быстрее

```sql
LEFT JOIN LATERAL (
    SELECT STRING_AGG(...) as phones
    FROM phones WHERE branch_id = b.id
) ph ON TRUE
```

**⚠️ Не менять обратно на коррелированные подзапросы!**

### 2. GIN триграммные индексы для ILIKE
**Где**: `schema.sql`
**Проблема**: `WHERE city ILIKE '%москва%'` = Seq Scan 100k строк
**Решение**: `CREATE INDEX ... USING GIN (city gin_trgm_ops)`
**Результат**: Bitmap Index Scan вместо Seq Scan

**Требует**: `CREATE EXTENSION IF NOT EXISTS pg_trgm;` перед запуском schema.sql

### 3. Connection Pool (psycopg2.SimpleConnectionPool)
**Конфиг**: env `DB_POOL_MIN=2`, `DB_POOL_MAX=10`
**Проблема**: Без пула каждый запрос = новое TCP соединение (~5ms)
**Решение**: Переиспользование соединений
**Где**: `main.py`, функция `get_db_connection()`

**⚠️ Всегда возвращайте соединение в пул через `release_db_connection(conn)`!**

### 4. In-memory кеш (60 секунд TTL)
**Класс**: `SimpleCache` в `main.py`
**Применение**: `/api/companies` запросы
**TTL**: 60 секунд без Redis
**Ключ**: MD5 от отсортированных параметров

### 5. Фильтры в `build_filter_clause()`
**Принцип**: Один источник правды для WHERE-условий
**Используется в**: `/api/companies` и `/api/export`
**Возвращает 4 значения**: `(where, params, having, having_params)`
**⚠️ Не дублировать фильтры!**

### 6. FAISS mapping: ids = category_id (НЕ company_id!)
**Контракт**: `rebuild_faiss.py` → `SELECT ARRAY_AGG(DISTINCT cat.id)` → mapping хранит category_id
**SQL**: `WHERE cc.category_id = ANY(%s)` — ожидает category_id
**⚠️ Нарушение контракта (company_id вместо category_id) → RESULT COUNT = 0**

### 7. Мульти-выбор категорий (AND-пересечение)
**Параметр**: `category_filter_ids` (comma-separated string, например "42,105")
**1 категория**: `WHERE cc.category_id = %s` (простой фильтр)
**2+ категорий**: `WHERE cc.category_id = ANY(%s) HAVING COUNT(DISTINCT cc.category_id) = %s`
**UI**: массив `categoryFilterIds = [{id, name}, ...]`, бейджи с удалением

---

## 📝 Правила для разработки

### SQL
- ✅ **Всегда параметризованные запросы**: `cur.execute(query, (param,))`
- ❌ **Никогда f-string**: `cur.execute(f"SELECT * FROM ... WHERE id={id}")` — SQL injection!
- ✅ **LATERAL JOIN** для подзапросов в SELECT
- ✅ **GROUP BY** вместо DISTINCT (более эффективно)

### Python
- ✅ psycopg2 синхронный (проект намеренно простой)
- ❌ Не менять на asyncpg без веских причин
- ✅ Переиспользовать `build_filter_clause()` для фильтров
- ✅ Переиспользовать `decode_punycode_domain()` для кириллических доменов
- ✅ Логирование через стандартный `print()` или import `logging`

### HTML/JS/CSS
- ✅ Vanilla JS (без React/Vue)
- ✅ Tailwind CSS только для базовых стилей
- ✅ Встроенный CSS для кастомных компонентов
- ❌ Не подключать lucide.js отдельно (используйте встроенные SVG)
- ✅ Escape HTML через `escapeHtml()` функцию

### Архитектура
- ✅ Монолит `main.py` (все эндпоинты в одном файле)
- ✅ Минимум зависимостей (requirements.txt: 15 пакетов)
- ✅ Нет очередей, асинхронности, микросервисов
- ❌ Не создавайте отдельные файлы для маршрутов/моделей

---

## 🧪 Кириллические домены (Recent Fix)

**Проблема**: Домены из 2ГИС хранятся в punycode (xn--...), но нужно отображать по-русски.

**Решение**: Функция `decode_punycode_domain()` в `main.py`
```python
def decode_punycode_domain(domain: str) -> str:
    """Декодирует xn--19-6kcajn3bks3n.xn--p1ai → аквалэнд19.рф"""
    # ... реализация
```

**Применяется в:**
- ✅ `/api/companies` → поле `domain`
- ✅ `/api/companies/{id}` → поле `domain` и `website`
- ✅ `/api/export` → CSV колонки Domain и Сайт

**⚠️ Обновите декодирование во всех трёх местах, если меняете логику!**

---

## 🎨 UI: LeadExtractor (SaaS redesign)

**Файл**: `templates/index.html` (1251 строк)

### Компоненты
- **Header**: Sticky с logo "LeadExtractor"
- **Hero**: Центральный блок с заголовком + поле ввода
- **Search Input**: 600-700px, border-radius 14px, встроенная кнопка "Найти лиды"
- **Suggestions**: 3 кликабельных примера поисков
- **Filters**: Collapsible блок "Дополнительные фильтры" (скрыт по умолчанию)
- **Table**: Результаты в таблице с раскрываемыми деталями
- **Pagination**: Пагинация по 100 результатов на странице

### AI-парсер запроса
Автоматически распознаёт фильтры из текста:
```
"кафе в Москве с телефоном"
  → category: кафе
  → city: Москве
  → has_phone: true
```

### Ключевые JS функции
- `handleSearch()` — основная функция поиска (вызывается кнопкой + Enter)
- `renderTable()` — отрисовка результатов в таблице
- `toggleRow(id)` — раскрытие детальной информации
- `loadDetails(id)` — загрузка деталей через API
- `exportCSV()` — скачивание CSV файла
- `resetFilters()` — очистка всех фильтров

### Стиль
- Светлый фон с градиентом
- Минимализм (как Stripe/Notion/Linear)
- Smooth анимации (fade-in, slide-down)
- Responsive дизайн (мобильный + десктоп)

---

## 📊 API Endpoints

### GET /api/companies
Список компаний с фильтрацией и пагинацией.

**Query params:**
- `city` (str) — фильтр по городу (ILIKE)
- `category` (str) — фильтр по категории
- `has_email` (bool) — только с email
- `has_phone` (bool) — только с телефоном
- `has_website` (bool) — только с сайтом
- `limit` (int, max 1000, default 50)
- `offset` (int, default 0)

**Response**: `{ "total": N, "limit": 50, "offset": 0, "data": [...] }`

### GET /api/companies/{id}
Детали одной компании (филиалы, контакты, категории, соцсети).

**Response**: `{ "company": {...}, "branches": [...], "emails": [...], "categories": [...], "socials": {...} }`

### GET /api/export
CSV экспорт с тем же фильтрацией что и `/api/companies`.

**Query params**: Те же что в `/api/companies`, но max limit = 50000
**Response**: CSV файл `leadextractor_export_YYYYMMDD_HHMMSS.csv`

**CSV Columns**: `ID, Название, Город, Домен, Сайт, Телефоны, Email, Адрес, Соцсети, Категории`

### POST /api/enrich/start
Запустить обогащение контактов (subprocess enrich.py в фоне).

**Query params:**
- `batch_size` (int, default 100) — размер батча
- `reset` (bool, default false) — сбросить все в pending перед запуском

**Response**: `{ "status": "started|already_running", ... }`

### GET /api/enrich/status
Текущий статус обогащения.

**Response**: `{ "total": N, "pending": N, "processing": N, "done": N, "failed": N, "progress_percent": 50, "is_running": true }`

### POST /api/enrich/stop
Остановить обогащение.

**Response**: `{ "status": "stopping", ... }`

### GET /health
Healthcheck API и БД.

**Response**: `{ "status": "ok", "message": "API и БД работают" }`

---

## 🔧 Переменные окружения (.env)

| Переменная | Default | Описание |
|------------|---------|----------|
| DB_HOST | localhost | PostgreSQL хост |
| DB_PORT | 5432 | PostgreSQL порт |
| DB_NAME | dbgis | Имя БД |
| DB_USER | postgres | Пользователь БД |
| DB_PASSWORD | postgres | Пароль БД |
| DB_POOL_MIN | 2 | Мин. соединений в пуле |
| DB_POOL_MAX | 10 | Макс. соединений в пуле |
| API_HOST | 0.0.0.0 | Хост для прослушивания |
| API_PORT | 8000 | Порт API |
| DEBUG | False | Подробные логи ошибок |
| SQLITE_PATH | ../dgdat2xlsx/data/local.db | Путь для миграции |

---

## 🐛 Частые проблемы и решения

### API возвращает 500 ошибку
- **Проверить логи**: `DEBUG=True python main.py`
- **Проверить БД**: `psql -d dbgis -c "SELECT 1"`
- **Проверить .env параметры**: `cat .env | grep DB_`

### Таблица не заполняется при поиске
- Очистить кэш браузера: Ctrl+Shift+R
- Проверить консоль браузера (F12) на JS ошибки
- Проверить сетевой запрос в DevTools (Network)

### Обогащение зависло
```bash
# Посмотреть статус
python enrich.py --status

# Остановить через API
curl -X POST http://localhost:8000/api/enrich/stop

# Или вручную
rm .enrichment_stop  # если зависло без флага
python enrich.py --start --continuous  # перезапустить
```

### Кириллические домены отображаются как xn--...
- **Проверить**: функция `decode_punycode_domain()` вызывается везде?
- **Fix**: Обновить в 3 местах: `/api/companies`, `/api/companies/{id}`, `/api/export`

---

## 📚 Дополнительные файлы

- **INSTALL.md** — Подробная инструкция установки PostgreSQL
- **README.md** — Полная документация проекта
- **CRITICAL_FIXES.md** — История критических проблем и их решений
- **MIGRATION_GUIDE.md** — Как мигрировать из SQLite в PostgreSQL
- **UI_IMPROVEMENTS.md** — История улучшений интерфейса
- **IMPLEMENTATION_NOTES.md** — Технические заметки при разработке

---

## 🚀 Развертывание на Production

### Gunicorn + Nginx
```bash
pip install gunicorn
gunicorn main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

### Systemd сервис
```ini
[Unit]
Description=dbgis API Server
After=network.target postgresql.service

[Service]
Type=notify
User=www-data
WorkingDirectory=/path/to/dbgis-backend
Environment="PATH=/path/to/dbgis-backend/venv/bin"
ExecStart=/path/to/dbgis-backend/venv/bin/gunicorn main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable dbgis
sudo systemctl start dbgis
sudo systemctl status dbgis
```

### Мониторинг
```bash
# Логи
journalctl -u dbgis -f

# Статус БД
curl http://localhost:8000/health

# Статус обогащения
curl http://localhost:8000/api/enrich/status
```
