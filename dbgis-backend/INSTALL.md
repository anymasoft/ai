# dbgis Backend — Инструкция по установке

Полнофункциональный backend для поиска организаций из 2ГИС.

## 📋 Требования

- Python 3.10+
- PostgreSQL 12+
- pip / poetry

## 🚀 Установка

### 1. Установка PostgreSQL

#### Windows:
1. Скачайте PostgreSQL с [postgresql.org](https://www.postgresql.org/download/windows/)
2. Запустите установщик
3. При установке запомните пароль для пользователя `postgres`
4. Выберите порт `5432` (по умолчанию)
5. Завершите установку

#### Linux (Ubuntu/Debian):
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib -y

# Стартуем сервис
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

#### macOS:
```bash
brew install postgresql
brew services start postgresql
```

---

### 2. Создание базы данных и пользователя

#### Windows (cmd или PowerShell):
```bash
# Подключитесь к PostgreSQL
psql -U postgres

# В интерпретаторе psql выполните:
CREATE DATABASE dbgis ENCODING 'UTF8';
CREATE USER dbgis_user WITH PASSWORD 'dbgis_password';
ALTER ROLE dbgis_user SET client_encoding TO 'utf8';
ALTER ROLE dbgis_user SET default_transaction_isolation TO 'read committed';
ALTER ROLE dbgis_user SET default_transaction_deferrable TO on;
ALTER ROLE dbgis_user SET default_transaction_read_only TO off;
GRANT ALL PRIVILEGES ON DATABASE dbgis TO dbgis_user;
\q
```

#### Linux/macOS:
```bash
# Из-под пользователя postgres
sudo -u postgres psql

# Или напрямую (если у вас настроена аутентификация):
psql -U postgres

# В интерпретаторе psql выполните команды выше
```

---

### 3. Применение схемы базы данных

```bash
# Из папки dbgis-backend
psql -U postgres -d dbgis -f schema.sql

# Или используя пользователя dbgis_user:
psql -U dbgis_user -d dbgis -f schema.sql
```

---

### 4. Установка Python-зависимостей

```bash
# Создайте виртуальное окружение
python -m venv venv

# Активируйте его
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# Установите зависимости
pip install -r requirements.txt
```

---

### 5. Конфигурация (.env)

Скопируйте `.env.example` в `.env`:

```bash
cp .env.example .env
```

Отредактируйте `.env`:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=dbgis
DB_USER=postgres
DB_PASSWORD=your_postgres_password  # Замените на ваш пароль

API_HOST=0.0.0.0
API_PORT=8000
DEBUG=False
SQLITE_PATH=../dgdat2xlsx/data/local.db
```

---

### 6. Миграция данных из SQLite

Если у вас уже есть данные в SQLite (из `dgdat2xlsx/data/local.db`):

```bash
python migrate_sqlite_to_postgres.py
```

Скрипт:
- ✅ Читает данные из SQLite
- ✅ Вставляет в PostgreSQL батчами (1000 записей за раз)
- ✅ Пропускает дубликаты (ON CONFLICT DO NOTHING)
- ✅ Выводит прогресс

---

### 7. Запуск сервера

```bash
# С горячей перезагрузкой (для разработки):
python -m uvicorn main:app --reload

# Или:
python main.py

# Production (без reload):
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

Сервер должен запуститься на `http://localhost:8000`

---

## 🔗 Endpoints

### Web UI
- **GET** `/` — главная страница с поиском

### API
- **GET** `/health` — проверка здоровья
- **GET** `/api/companies?city=...&category=...&limit=50` — список компаний с фильтрами
- **GET** `/api/companies/{id}` — полная информация о компании
- **GET** `/api/export?...` — экспорт результатов в CSV

---

## 🛠️ Администрирование БД

### Базовые команды psql

```bash
# Подключение
psql -U postgres -d dbgis

# Внутри psql:

# Список таблиц
\dt

# Информация о таблице
\d companies

# SELECT все компании
SELECT * FROM companies LIMIT 10;

# Подсчёт записей
SELECT COUNT(*) FROM companies;

# Удаление всех записей (осторожно!)
DELETE FROM companies;

# Выход
\q
```

---

## 🖥️ Графический интерфейс для БД (опционально)

### DBeaver (Рекомендуется)
1. Скачайте [DBeaver Community](https://dbeaver.io/)
2. Установите
3. New Database Connection → PostgreSQL
4. Укажите параметры подключения

### pgAdmin
1. Скачайте [pgAdmin](https://www.pgadmin.org/)
2. Запустите
3. Укажите параметры PostgreSQL

---

## 📊 Структура таблиц

```
companies
├── id (PRIMARY KEY)
├── name
├── city
├── website
├── domain
├── created_at
└── updated_at

branches
├── id (PRIMARY KEY)
├── company_id (FOREIGN KEY)
├── address
├── postal_code
├── working_hours
├── building_name
├── building_type
└── branch_hash (UNIQUE)

phones
├── id (PRIMARY KEY)
├── branch_id (FOREIGN KEY)
└── phone (UNIQUE per branch)

emails
├── id (PRIMARY KEY)
├── company_id (FOREIGN KEY)
└── email (UNIQUE per company)

socials
├── id (PRIMARY KEY)
├── company_id (FOREIGN KEY)
├── type (VK, Facebook, Twitter, etc)
└── url (UNIQUE per company+type)

categories
├── id (PRIMARY KEY)
├── name
└── parent_id (FOREIGN KEY) — иерархия

company_categories
├── company_id (FOREIGN KEY)
└── category_id (FOREIGN KEY)
```

---

## 🐛 Troubleshooting

### "connection refused" при подключении к PostgreSQL
```bash
# Проверьте, запущен ли PostgreSQL
# Windows: Services → postgresql-x64
# Linux: sudo systemctl status postgresql
# macOS: brew services list
```

### "database does not exist"
```bash
# Убедитесь, что база создана:
psql -U postgres -c "CREATE DATABASE dbgis;"
```

### Миграция зависает
- Убедитесь, что SQLite файл существует (`../dgdat2xlsx/data/local.db`)
- Проверьте права доступа к файлу
- Используйте `SQLITE_PATH` в `.env`

### Медленная загрузка результатов
- Проверьте индексы: `\d companies` в psql
- Убедитесь, что индексы созданы (schema.sql)
- Может потребоваться `ANALYZE` таблиц:
  ```bash
  psql -U postgres -d dbgis -c "ANALYZE;"
  ```

---

## 📝 Примеры использования

### Через curl
```bash
# Поиск компаний в Санкт-Петербурге
curl "http://localhost:8000/api/companies?city=Санкт-Петербург&limit=10"

# С фильтром по категории
curl "http://localhost:8000/api/companies?city=Москва&category=Кафе"

# Только с email
curl "http://localhost:8000/api/companies?has_email=true&limit=50"

# Экспорт в CSV
curl "http://localhost:8000/api/export?city=Москва" > export.csv
```

### Через Python
```python
import requests

response = requests.get(
    "http://localhost:8000/api/companies",
    params={
        "city": "Москва",
        "category": "Кафе",
        "has_email": True,
        "limit": 50
    }
)
data = response.json()
print(f"Найдено {data['total']} компаний")
for company in data['data']:
    print(company['name'], company['city'])
```

---

## 🔐 Production советы

1. **Безопасность БД**
   - Используйте сильные пароли
   - Ограничьте доступ на уровне firewall
   - Не коммитьте реальные пароли в `.env`

2. **Производительность**
   - Включите connection pooling
   - Используйте кеширование (Redis)
   - Регулярно делайте `VACUUM ANALYZE`

3. **Резервные копии**
   ```bash
   # Бэкап
   pg_dump -U postgres dbgis > backup.sql

   # Восстановление
   psql -U postgres -d dbgis -f backup.sql
   ```

---

## 📚 Документация

- [PostgreSQL](https://www.postgresql.org/docs/)
- [FastAPI](https://fastapi.tiangolo.com/)
- [psycopg2](https://www.psycopg.org/)

---

**Готово!** 🎉 Ваш backend для dbgis работает.
