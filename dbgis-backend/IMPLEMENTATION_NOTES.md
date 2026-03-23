# Разделение источников данных (2GIS vs enrichment)

## ✅ Внедренные изменения

### 1. Структура БД (schema.sql)
Добавлены колонки `source` в таблицы `emails` и `phones`:
```sql
ALTER TABLE emails ADD COLUMN source TEXT DEFAULT '2gis';
ALTER TABLE phones ADD COLUMN source TEXT DEFAULT '2gis';
```

**Значения:**
- `'2gis'` — данные из исходной миграции SQLite
- `'enrichment'` — данные из обогащения сайтов

**Полная информация:**
```sql
emails(id, company_id, email, source)
phones(id, branch_id, phone, source)
```

---

### 2. Миграция данных (migrate_sqlite_to_postgres.py)
При переносе из SQLite все записи помечаются как `source='2gis'`:

```python
# phones
rows.append((row['id'], row['branch_id'], row['phone'], '2gis'))
INSERT INTO phones (id, branch_id, phone, source) VALUES (%s, %s, %s, %s)

# emails
rows.append((row['id'], row['company_id'], row['email'].lower(), '2gis'))
INSERT INTO emails (id, company_id, email, source) VALUES (%s, %s, %s, %s)
```

---

### 3. Обогащение данных (enrich.py)
При добавлении контактов с сайтов все записи помечаются как `source='enrichment'`:

```python
# emails
INSERT INTO emails (company_id, email, source) VALUES (%s, %s, 'enrichment')

# phones
INSERT INTO phones (branch_id, phone, source) VALUES (%s, %s, 'enrichment')
```

---

### 4. API сортировка (main.py)
Контакты в API возвращаются в порядке: **enrichment → 2gis**

```sql
-- В LATERAL JOIN для emails и phones
STRING_AGG(
  p.phone, ', '
  ORDER BY CASE WHEN source = 'enrichment' THEN 1 ELSE 2 END
) as phones
```

**Примеры эндпоинтов:**
- `GET /api/companies/{id}` — детали с отсортированными контактами
- `GET /api/companies` — список с объединёнными контактами

---

### 5. SQL миграция (migrations/002_add_source_to_emails_phones.sql)
Для существующих баз данных:
```bash
psql -d dbgis -f migrations/002_add_source_to_emails_phones.sql
```

Это добавит колонку с дефолтом `'2gis'` для старых записей.

---

## 🧪 Проверка целостности

### Проверить структуру
```sql
-- Убедиться, что колонки добавлены с правильным типом
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name IN ('emails', 'phones')
  AND column_name = 'source'
ORDER BY table_name;
```

### Проверить данные
```sql
-- Статистика по источникам
SELECT
  'emails' as table_name, source, COUNT(*) as count
FROM emails GROUP BY source
UNION ALL
SELECT
  'phones' as table_name, source, COUNT(*) as count
FROM phones GROUP BY source;

-- Результат до первого обогащения:
-- | table_name | source | count  |
-- |------------|--------|--------|
-- | emails     | 2gis   | 12500  |
-- | phones     | 2gis   | 8300   |
```

### Проверить сортировку в API
```sql
-- Выборка для компании с разными источниками контактов
SELECT
  company_id,
  STRING_AGG(email, ', ' ORDER BY CASE WHEN source = 'enrichment' THEN 1 ELSE 2 END) as emails,
  STRING_AGG(source, ', ' ORDER BY CASE WHEN source = 'enrichment' THEN 1 ELSE 2 END) as sources
FROM emails
WHERE source IN ('2gis', 'enrichment')
GROUP BY company_id
LIMIT 5;
```

---

## 📋 Документация для UI

**Никакие изменения не нужны:**
- UI получает объединённые контакты через API
- Сортировка по приоритету происходит на уровне БД
- UI видит: `emails: "a@enriched.com, b@2gis.com"` (enrichment первым)

---

## 🔄 Примеры использования

### Python: Добавить email из 2GIS
```python
cur.execute(
    "INSERT INTO emails (company_id, email, source) VALUES (%s, %s, '2gis')",
    (company_id, email)
)
```

### Python: Добавить email из enrichment
```python
cur.execute(
    "INSERT INTO emails (company_id, email, source) VALUES (%s, %s, 'enrichment')",
    (company_id, email)
)
```

### SQL: Вывести emails с источниками
```sql
SELECT company_id, email, source FROM emails
ORDER BY company_id, CASE WHEN source = 'enrichment' THEN 1 ELSE 2 END;
```

### SQL: Подсчитать sources
```sql
SELECT source, COUNT(*) FROM emails GROUP BY source;
-- | source      | count |
-- |-------------|-------|
-- | 2gis        | 12500 |
-- | enrichment  | 450   |
```

---

## ⚠️ Важно

### ✅ Что не сломалось:
- ✓ Все существующие данные сохранены
- ✓ DEFAULT='2gis' для обратной совместимости
- ✓ ON CONFLICT DO NOTHING предотвращает дубли
- ✓ UI получает данные без изменений
- ✓ API работает с обьединённой выборкой

### ✅ Никакие файлы не потеряны:
- ✓ Нет DELETE операций
- ✓ Нет переписывания архитектуры
- ✓ Нет separate таблиц enrichment_emails
- ✓ Нет логики merge во frontend

---

## 🚀 Миграция на production

### Шаг 1: Обновить схему
```bash
psql -d dbgis -f migrations/002_add_source_to_emails_phones.sql
```

### Шаг 2: Перезапустить миграцию SQLite (опционально)
```bash
python migrate_sqlite_to_postgres.py
```
(Все новые миграции будут иметь source='2gis')

### Шаг 3: Перезагрузить API
```bash
# Сервис автоматически использует новые колонки
python main.py  # или systemctl restart dbgis-backend
```

### Шаг 4: Запустить enrichment
```bash
python enrich.py --continuous
```
(Новые контакты получат source='enrichment')

---

## 📊 Результат

После применения всех изменений:
```sql
SELECT email, source FROM emails LIMIT 10;
-- | email           | source      |
-- |-----------------|-------------|
-- | admin@site.com  | enrichment  |
-- | info@company.ru | 2gis        |
-- | help@example.com| 2gis        |
```

**Преимущества:**
- 🎯 Можно отследить источник каждого контакта
- 📊 Управлять приоритетом (enrichment vs 2GIS)
- 🔍 Анализировать покрытие обогащения
- 🛡️ Никаких потерь данных, архитектура не изменена

