# Руководство по применению миграций

## Быстрый старт

### Применить миграцию 002 (добавление source к emails/phones)

**Вариант 1: Через быстрый скрипт**
```bash
cd dbgis-backend
python migrations/apply_002.py
```

**Вариант 2: Через общий скрипт миграций**
```bash
cd dbgis-backend
python migrations/run_migration.py 002_add_source_to_emails_phones.sql
```

### Проверка подключения

Убедитесь, что в файле `.env` установлены правильные параметры:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=dbgis
DB_USER=ваше_имя_пользователя
DB_PASSWORD=ваш_пароль
```

---

## Что делает миграция 002

Добавляет колонку `source` в таблицы:
- `emails.source` — источник email (2gis или enrichment)
- `phones.source` — источник телефона (2gis или enrichment)

**По умолчанию**: все существующие контакты помечены как `'2gis'` (из исходной БД 2ГИС)

**При обогащении**: новые контакты, добавленные через `enrich.py`, помечаются как `'enrichment'`

---

## Как работают Python-скрипты миграций

### `run_migration.py` — главный скрипт миграций

Универсальный скрипт, который:
- ✓ Читает параметры БД из `.env`
- ✓ Подключается к PostgreSQL
- ✓ Выполняет SQL-команды из файла миграции
- ✓ Обрабатывает ошибки и уже примененные команды

**Использование:**
```bash
# Список доступных миграций
python run_migration.py

# Применить конкретную миграцию
python run_migration.py 002_add_source_to_emails_phones.sql
python run_migration.py 001_enrichment.sql
```

### `apply_002.py` — быстрый скрипт для миграции 002

Упрощенный скрипт, специально для миграции 002:
```bash
python apply_002.py
```

Эквивалентно:
```bash
python run_migration.py 002_add_source_to_emails_phones.sql
```

---

## Полный процесс установки (с нуля)

### 1. Создать .env файл

```bash
cp .env.example .env
# Отредактировать .env с правильными параметрами БД
```

### 2. Установить зависимости

```bash
pip install -r requirements.txt
```

### 3. Создать БД и применить схему

```bash
# Создать пустую БД (в PostgreSQL)
createdb dbgis

# Применить основную схему
python -c "
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
conn = psycopg2.connect(
    host=os.getenv('DB_HOST'),
    port=int(os.getenv('DB_PORT')),
    database=os.getenv('DB_NAME'),
    user=os.getenv('DB_USER'),
    password=os.getenv('DB_PASSWORD')
)

with open('schema.sql', 'r') as f:
    with conn.cursor() as cur:
        cur.execute(f.read())
conn.commit()
conn.close()
print('✓ Schema applied')
"
```

### 4. Импортировать данные из SQLite

```bash
python migrate_sqlite_to_postgres.py
```

Этот скрипт:
- ✓ Читает данные из `dgdat2xlsx/data/local.db` (SQLite)
- ✓ Импортирует все таблицы в PostgreSQL
- ✓ Помечает все импортированные контакты как `source='2gis'` (строка 154-160)
- ✓ Обновляет SERIAL sequences

### 5. Применить дополнительные миграции

```bash
python migrations/apply_002.py
```

### 6. Запустить приложение

```bash
python main.py
```

Или через uvicorn:
```bash
uvicorn main:app --reload
```

---

## Что если миграция не применилась

### Ошибка: "connection to server ... failed"

**Причина**: неправильные параметры подключения в `.env`

**Решение**:
1. Проверьте параметры в `.env`:
   ```bash
   echo $DB_HOST
   echo $DB_USER
   ```
2. Убедитесь, что PostgreSQL запущен:
   ```bash
   # Linux/Mac
   pg_isready -h localhost -p 5432

   # Windows: откройте PostgreSQL в Services
   ```
3. Проверьте, что БД существует:
   ```bash
   psql -l -U postgres  # Список БД
   ```

### Ошибка: "column "source" of relation "emails" already exists"

**Это нормально** — миграция уже применена. Скрипт обработает это и продолжит работу.

### Ошибка: "permission denied for schema public"

**Причина**: у пользователя БД нет прав

**Решение**:
```bash
# Подключитесь как postgres и выдайте права:
sudo -u postgres psql -d dbgis -c "GRANT ALL ON SCHEMA public TO your_user;"
```

---

## Проверка успешной миграции

После применения миграции, проверьте, что колонка добавлена:

```python
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
conn = psycopg2.connect(
    host=os.getenv('DB_HOST'),
    database=os.getenv('DB_NAME'),
    user=os.getenv('DB_USER'),
    password=os.getenv('DB_PASSWORD')
)

with conn.cursor() as cur:
    # Проверим колонки таблицы emails
    cur.execute("""
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_name = 'emails'
        ORDER BY ordinal_position
    """)
    print("Колонки таблицы emails:")
    for col_name, col_type in cur.fetchall():
        print(f"  - {col_name}: {col_type}")

conn.close()
```

**Ожидаемый результат:**
```
Колонки таблицы emails:
  - id: integer
  - branch_id: integer
  - email: text
  - source: text        ← новая колонка
```

---

## API и источники данных

### До миграции
```python
# /api/companies возвращает первый email, но неизвестно откуда
{
    "id": 123,
    "name": "ООО Рога и копыта",
    "emails": ["info@example.com", "sales@example.com"],
    "phones": ["+7-999-111-11-11"]
}
```

### После миграции
```python
# emails отсортированы: enrichment сначала
{
    "id": 123,
    "name": "ООО Рога и копыта",
    "emails": [
        {"email": "sales@example.com", "source": "enrichment"},   # обогащённый
        {"email": "info@example.com", "source": "2gis"}          # исходный
    ],
    "phones": [
        {
            "phone": "+7-999-222-22-22",
            "source": "enrichment"
        },
        {
            "phone": "+7-999-111-11-11",
            "source": "2gis"
        }
    ]
}
```

**Сортировка**: обогащённые контакты идут первыми (лучше качество)

---

## Интеграция с enrich.py

После применения миграции 002, скрипт `enrich.py` будет:

1. Автоматически помечать новые контакты как `source='enrichment'`
2. SQL-запросы будут отсортировать результаты (enrichment первым)
3. Таблица и API будут показывать обогащённые контакты в приоритете

---

## Документация по миграциям

### Существующие миграции

| № | Файл | Описание | Статус |
|---|------|---------|--------|
| 001 | `001_enrichment.sql` | Добавляет поля enrichment_status, enriched_at | ✓ |
| 002 | `002_add_source_to_emails_phones.sql` | Добавляет колонку source в emails/phones | ✓ |

### Как добавить новую миграцию

1. Создайте файл `migrations/NNN_description.sql`
2. Напишите SQL-команды (каждая заканчивается `;`)
3. Применить:
   ```bash
   python run_migration.py NNN_description.sql
   ```

**Пример:**
```sql
-- migrations/003_add_new_column.sql
ALTER TABLE companies ADD COLUMN new_field TEXT;
COMMENT ON COLUMN companies.new_field IS 'Описание нового поля';
```

```bash
python run_migration.py 003_add_new_column.sql
```

---

## Troubleshooting

### Скрипт работает, но ничего не происходит

Проверьте логи:
```bash
python -u migrations/apply_002.py 2>&1 | tee migration.log
```

### Нужно откатить миграцию

Сейчас отката нет (нужно писать reverse-миграцию).
Временный вариант:
```bash
sudo -u postgres psql -d dbgis -c "ALTER TABLE emails DROP COLUMN source;"
```

### Работает локально, но не работает на сервере

Проверьте:
1. Параметры `.env` на сервере
2. Параметры сетевого подключения (host, port)
3. Права пользователя БД на сервере

```bash
# На сервере проверить подключение
psql -h DB_HOST -U DB_USER -d dbgis -c "SELECT version();"
```

---

## Команды для частых задач

```bash
# Просмотр всех миграций
python migrations/run_migration.py

# Применить миграцию 002
python migrations/apply_002.py

# Проверить структуру таблицы emails
python -c "
import psycopg2
import os
from dotenv import load_dotenv
load_dotenv()
conn = psycopg2.connect(host=os.getenv('DB_HOST'), database=os.getenv('DB_NAME'), user=os.getenv('DB_USER'), password=os.getenv('DB_PASSWORD'))
cur = conn.cursor()
cur.execute('SELECT column_name, data_type FROM information_schema.columns WHERE table_name = \"emails\" ORDER BY ordinal_position')
for col, typ in cur.fetchall():
    print(f'{col}: {typ}')
cur.close()
conn.close()
"

# Полный цикл установки (после git clone)
pip install -r requirements.txt
python migrations/apply_002.py  # (если БД уже создана и schema применена)
python main.py
```

