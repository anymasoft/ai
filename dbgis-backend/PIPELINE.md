# Полный rebuild данных: от .dgdat до работающего поиска

## Схема пайплайна

```
.dgdat файлы → XLSX → SQLite → PostgreSQL → FAISS индекс → API
```

## Предварительные требования

- Python 3.11+
- PostgreSQL запущен, БД создана (см. INSTALL.md)
- `pip install -r requirements.txt` в `dgdat2xlsx/` и `dbgis-backend/`

---

## Шаг 1. Конвертация .dgdat → XLSX

```bash
cd dgdat2xlsx
python convert.py
```

Читает `.dgdat` файлы из `input/`, создаёт `.xlsx` в `output/`.
Каждая строка — компания с 24 колонками (название, город, категории, контакты и т.д.).

## Шаг 2. Импорт XLSX → SQLite

```bash
cd dgdat2xlsx
rm -f data/local.db          # удалить старую БД (если нужен полный rebuild)
python import_db.py
```

Создаёт `data/local.db` с таблицами: `cities`, `companies`, `branches`, `phones`, `emails`, `socials`, `categories`, `company_categories`, `company_aliases`.

**Проверка:**
```bash
sqlite3 data/local.db "SELECT COUNT(*) FROM companies; SELECT COUNT(*) FROM cities; SELECT COUNT(*) FROM categories;"
```

## Шаг 3. Очистка PostgreSQL (только при полном rebuild)

```bash
cd dbgis-backend
python clean_postgres.py --force
```

TRUNCATE всех таблиц + сброс sequences. Пропустите этот шаг, если нужен инкрементальный апдейт.

## Шаг 4. Синхронизация SQLite → PostgreSQL

```bash
cd dbgis-backend
python sync_sqlite_to_postgres.py
```

Инкрементальный UPSERT из SQLite. Порядок: `cities` → `companies` → `branches` → `phones` → `emails` → `socials` → `categories` → `company_categories` → `company_aliases`.

**Проверка:**
```bash
psql -c "SELECT COUNT(*) FROM companies; SELECT COUNT(*) FROM cities;"
```

## Шаг 5. Пересборка FAISS индекса

```bash
cd dbgis-backend
python rebuild_faiss.py
```

Строит семантический индекс категорий для поиска. Создаёт файлы `categories_faiss_e5.index` и `category_mapping_e5.json`.

**Проверка:**
```bash
python rebuild_faiss.py --test-query "кафе"
```

## Шаг 6. Проверка работы

```bash
cd dbgis-backend

# Диагностика поиска (5 шагов: FAISS → PostgreSQL → компании)
python debug_search.py "кафе в москве"

# Запуск API
python main.py

# Тест эндпоинтов
curl http://localhost:8000/health
curl "http://localhost:8000/api/companies?query=кафе+в+москве&limit=5"

# Тест качества поиска (88 запросов)
python test_search.py
```

---

## Быстрая команда: полный rebuild одной строкой

```bash
cd dgdat2xlsx && python convert.py && rm -f data/local.db && python import_db.py && cd ../dbgis-backend && python clean_postgres.py --force && python sync_sqlite_to_postgres.py && python rebuild_faiss.py && python debug_search.py "автосервис"
```

## Инкрементальное обновление (без потери данных)

Если нужно обновить только данные без полной пересборки:

```bash
cd dgdat2xlsx && python convert.py && python import_db.py
cd ../dbgis-backend && python sync_sqlite_to_postgres.py && python rebuild_faiss.py
```
