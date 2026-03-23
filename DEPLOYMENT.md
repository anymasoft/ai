# Полная инструкция: от dgdat → XLSX → PostgreSQL → Web API

Архитектура системы для работы с данными 2ГИС (dbgis).

```
dgdat файлы (2ГИС)
    ↓
[convert.py] ← Парсинг бинарных данных
    ↓
XLSX файлы (output/)
    ↓
[import_db.py] ← Импорт в SQLite, нормализация
    ↓
SQLite БД (data/local.db)
    ↓
[migrate_sqlite_to_postgres.py] ← Миграция
    ↓
PostgreSQL БД (dbgis)
    ↓
[main.py] ← FastAPI backend
    ↓
Web UI / REST API
    ↓
Пользователи, интеграции, экспорт
```

---

## 📦 Проекты

### 1. dgdat2xlsx
**Путь:** `dgdat2xlsx/`

Парсинг бинарных файлов 2ГИС в XLSX и SQLite.

**Основные файлы:**
- `convert.py` — парсинг dgdat → XLSX
- `import_db.py` — импорт XLSX → SQLite
- `data/local.db` — SQLite база данных

**Формат данных:** 23 колонки (ID, Название, Город, Раздел, Подраздел, Рубрика, Телефоны, Факсы, Email, Сайт, Адрес, Почтовый индекс, Типы платежей, Время работы, Собственное название строения, Назначение строения, VK, Facebook, Skype, Twitter, Instagram, ICQ, Jabber)

**Запуск:**
```bash
cd dgdat2xlsx

# 1. Парсинг dgdat → XLSX
python convert.py

# 2. Импорт XLSX → SQLite (с защитой от NULL-перезаписи)
python import_db.py
```

---

### 2. dbgis-backend
**Путь:** `dbgis-backend/`

Full-stack backend с PostgreSQL, FastAPI и веб-интерфейсом.

**Основные файлы:**
- `main.py` — FastAPI сервер с REST API
- `schema.sql` — схема PostgreSQL
- `migrate_sqlite_to_postgres.py` — миграция данных
- `templates/index.html` — веб-интерфейс

**Стек:**
- FastAPI
- PostgreSQL
- HTML5 + Vanilla JS + Tailwind CSS

**Запуск:**
```bash
cd dbgis-backend

# Setup (автоматическая установка)
bash setup.sh        # Linux/macOS
setup.bat           # Windows

# Вручную:
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Отредактируйте .env

# Создание БД
psql -U postgres -f schema.sql

# Миграция данных
python migrate_sqlite_to_postgres.py

# Запуск
python main.py
# или
python -m uvicorn main:app --reload
```

---

## 🚀 Полная установка с нуля

### Шаг 1: Установка зависимостей

#### Windows:
1. **PostgreSQL**
   - Скачайте [postgresql.org](https://postgresql.org/download/windows/)
   - Установите, запомните пароль для `postgres`

2. **Python**
   - Скачайте [python.org](https://www.python.org/downloads/) (3.10+)
   - При установке: ✓ Add Python to PATH

#### Linux (Ubuntu):
```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib python3.11 python3.11-venv python3-pip

# Запуск PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

#### macOS:
```bash
# Brew
brew install postgresql python@3.11

# Запуск
brew services start postgresql
```

---

### Шаг 2: Подготовка dgdat2xlsx

```bash
cd dgdat2xlsx

# Убедитесь, что есть .dgdat файлы в папке download/

# 1. Парсинг dgdat → XLSX
python convert.py
# Результаты в output/

# 2. Импорт XLSX → SQLite (с защитой от NULL-перезаписи)
python import_db.py
# БД в data/local.db

# Проверка
sqlite3 data/local.db "SELECT COUNT(*) FROM companies;"
```

---

### Шаг 3: Настройка PostgreSQL

```bash
# Подключение к PostgreSQL
psql -U postgres

# В интерпретаторе psql:
CREATE DATABASE dbgis ENCODING 'UTF8';
CREATE USER dbgis_user WITH PASSWORD 'secure_password';
ALTER ROLE dbgis_user SET client_encoding TO 'utf8';
GRANT ALL PRIVILEGES ON DATABASE dbgis TO dbgis_user;
\q
```

---

### Шаг 4: Развертывание dbgis-backend

```bash
cd dbgis-backend

# Автоматический setup
bash setup.sh        # Linux/macOS
setup.bat           # Windows

# Или вручную:
python -m venv venv
source venv/bin/activate  # или venv\Scripts\activate
pip install -r requirements.txt

# Конфигурация
cp .env.example .env
# Отредактируйте .env:
# DB_HOST=localhost
# DB_USER=dbgis_user
# DB_PASSWORD=secure_password

# Создание схемы БД
psql -U dbgis_user -d dbgis -f schema.sql

# Миграция данных из SQLite
python migrate_sqlite_to_postgres.py

# Проверка миграции
psql -U dbgis_user -d dbgis -c "SELECT COUNT(*) FROM companies;"
```

---

### Шаг 5: Запуск сервера

```bash
cd dbgis-backend

# С горячей перезагрузкой (разработка)
python -m uvicorn main:app --reload

# Или просто
python main.py

# Production (без reload)
python -m uvicorn main:app --host 0.0.0.0 --port 8000
```

**Откройте в браузере:** http://localhost:8000

---

## 🔧 Конфигурация

### dbgis-backend/.env

```env
# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=dbgis
DB_USER=dbgis_user
DB_PASSWORD=your_secure_password

# FastAPI
API_HOST=0.0.0.0
API_PORT=8000
DEBUG=False

# Путь к SQLite для миграции
SQLITE_PATH=../dgdat2xlsx/data/local.db
```

---

## 📊 Проверка данных

### SQLite (dgdat2xlsx)
```bash
cd dgdat2xlsx

sqlite3 data/local.db

> SELECT COUNT(*) FROM companies;
> SELECT COUNT(*) FROM categories;
> SELECT * FROM companies LIMIT 5;
```

### PostgreSQL (dbgis-backend)
```bash
psql -U dbgis_user -d dbgis

> SELECT COUNT(*) FROM companies;
> SELECT COUNT(*) FROM categories;
> SELECT * FROM companies LIMIT 5;
```

---

## 🌐 Использование API

### REST Endpoints

```bash
# Получить компании в Москве
curl "http://localhost:8000/api/companies?city=Москва&limit=10"

# С фильтром по категории
curl "http://localhost:8000/api/companies?city=Москва&category=Кафе&limit=10"

# Только с email и сайтом
curl "http://localhost:8000/api/companies?has_email=true&has_website=true&limit=50"

# Получить компанию подробно (ID=123)
curl "http://localhost:8000/api/companies/123"

# Экспорт в CSV
curl "http://localhost:8000/api/export?city=Москва&limit=5000" > export.csv

# Проверка здоровья
curl "http://localhost:8000/health"
```

### Web UI

1. Откройте http://localhost:8000
2. Введите город и/или категорию
3. Установите фильтры (email, телефон, сайт)
4. Нажмите "Найти"
5. Скачайте CSV кнопкой "Скачать CSV"

---

## 🛠️ Администрирование

### Подключение к БД

**psql (командная строка):**
```bash
psql -U dbgis_user -d dbgis

# Внутри:
\dt              # Список таблиц
\d companies     # Структура таблицы
SELECT COUNT(*) FROM companies;
\q              # Выход
```

**DBeaver (графический интерфейс, рекомендуется):**
1. Скачайте [DBeaver Community](https://dbeaver.io/)
2. New Database Connection → PostgreSQL
3. Host: localhost
4. Database: dbgis
5. Username: dbgis_user
6. Password: ваш пароль

**pgAdmin:**
1. Скачайте [pgAdmin](https://pgadmin.org/)
2. Добавьте сервер PostgreSQL
3. Подключитесь к базе dbgis

---

## 🔄 Обновление данных

### Когда появились новые .dgdat файлы:

```bash
# 1. Обновить XLSX
cd dgdat2xlsx
python convert.py

# 2. Обновить SQLite
python import_db.py

# 3. Переимпортировать в PostgreSQL (будет добавлены новые)
cd ../dbgis-backend
python migrate_sqlite_to_postgres.py
```

---

## 📈 Производительность

### Индексы

Все индексы создаются автоматически при выполнении `schema.sql`:

```sql
CREATE INDEX idx_companies_city ON companies(city);
CREATE INDEX idx_companies_domain ON companies(domain);
CREATE INDEX idx_companies_name ON companies(name);
-- и другие...
```

### Анализ таблиц

```bash
psql -U dbgis_user -d dbgis -c "ANALYZE;"
```

### Размер БД

```bash
psql -U dbgis_user -d dbgis -c "
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"
```

---

## 🔐 Security

### Production советы

1. **Пароли**
   - Используйте сильные пароли (20+ символов)
   - Не коммитьте .env в git

2. **Firewall**
   - Ограничьте доступ к PostgreSQL (только localhost или VPN)
   - Используйте SSL для удалённых подключений

3. **API Rate Limiting**
   - Добавьте rate limiting для /api/export
   - Максимум 5000 записей на экспорт

4. **Резервные копии**
   ```bash
   # Бэкап
   pg_dump -U dbgis_user dbgis > backup_$(date +%Y%m%d).sql

   # Восстановление
   psql -U dbgis_user dbgis < backup_20240315.sql
   ```

---

## 🐛 Troubleshooting

### "database does not exist"
```bash
psql -U postgres -c "CREATE DATABASE dbgis;"
```

### "permission denied" при импорте XLSX
- Убедитесь, что output/ существует
- Проверьте права доступа к папке

### Миграция зависает
- Убедитесь, что SQLite БД не пуста
- Проверьте параметры в .env

### Медленные запросы
- Запустите ANALYZE: `psql -U dbgis_user -d dbgis -c "ANALYZE;"`
- Проверьте индексы: `SELECT * FROM pg_stat_user_indexes;`

### API возвращает 503 (БД недоступна)
- Проверьте, запущена ли PostgreSQL: `psql -U postgres -c "SELECT 1;"`
- Проверьте параметры подключения в .env

---

## 📚 Документация по проектам

- **dgdat2xlsx**: `dgdat2xlsx/DOCS.md` и `dgdat2xlsx/CLAUDE.md`
- **dbgis-backend**: `dbgis-backend/README.md` и `dbgis-backend/INSTALL.md`

---

## 🎯 Примеры использования

### Поиск лидов (B2B)
```
Город: Москва
Категория: Кафе
Только с email: ✓
Только с сайтом: ✓
```
→ Скачать CSV → Экспорт в CRM

### Аналитика ниш
```
Категория: Кофейни
Лимит: 1000
```
→ Подсчитать географическое распределение

### Проверка конкурентов
```
Категория: SEO Агентства
Город: Санкт-Петербург
```
→ Собрать контакты и анализировать

---

**Готово!** Система полностью развёрнута и готова к использованию. 🚀
