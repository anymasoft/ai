# dbgis — Backend для поиска организаций

Минимальный, но полнофункциональный backend для поиска и фильтрации организаций из базы данных 2ГИС.

**Стек:**
- FastAPI (Python 3.10+)
- PostgreSQL 12+
- HTML5 + Vanilla JS + Tailwind CSS
- Jinja2 (для шаблонов)

**Без Docker, без лишних зависимостей.**

---

## 📦 Быстрый старт

### 1️⃣ Установка PostgreSQL
Смотрите [INSTALL.md](INSTALL.md#1-установка-postgresql)

### 2️⃣ Создание БД
```bash
psql -U postgres -f schema.sql
```

### 3️⃣ Установка зависимостей
```bash
python -m venv venv
source venv/bin/activate  # или venv\Scripts\activate на Windows
pip install -r requirements.txt
```

### 4️⃣ Конфигурация
```bash
cp .env.example .env
# Отредактируйте .env с вашими параметрами PostgreSQL
```

### 5️⃣ Миграция данных (опционально)
Если у вас уже есть SQLite база:
```bash
python migrate_sqlite_to_postgres.py
```

### 6️⃣ Запуск сервера
```bash
python main.py
# или
python -m uvicorn main:app --reload
```

Откройте браузер: **http://localhost:8000**

---

## 🎯 Возможности

### 🔍 Web Interface
- Фильтрация по городу
- Фильтрация по категории/рубрике
- Фильтр по наличию email, телефона, сайта
- Регулировка количества результатов
- Таблица с результатами (имя, город, домен, телефон, email, категории)
- **Экспорт в CSV**

### 🔌 REST API
```
GET /api/companies?city=Москва&category=Кафе&has_email=true&limit=50
GET /api/companies/{id}
GET /api/export?city=Москва&limit=1000
```

### ⚡ Performance
- Batch insert при миграции (1000 записей за раз)
- Индексы на все поля поиска
- Пулинг соединений к БД
- Легкий HTML + CSS без излишеств

---

## 📁 Структура проекта

```
dbgis-backend/
├── main.py                      # FastAPI сервер + API endpoints
├── migrate_sqlite_to_postgres.py # Миграция из SQLite
├── schema.sql                   # Схема PostgreSQL
├── requirements.txt             # Python зависимости
├── .env.example                 # Пример конфигурации
├── INSTALL.md                   # Подробная инструкция установки
├── README.md                    # Этот файл
└── templates/
    └── index.html               # Web интерфейс
```

---

## 🗄️ Схема БД

8 таблиц, синхронизированы с `dgdat2xlsx/import_db.py`:

- **companies** — организации
- **branches** — филиалы/подразделения
- **phones** — телефоны филиалов
- **emails** — email адреса
- **socials** — соцсети (VK, Facebook, Twitter...)
- **categories** — иерархия рубрик
- **company_categories** — связь компаний с рубриками
- **company_aliases** — альтернативные названия

---

## 🛠️ API Endpoints

### Здоровье сервера
```
GET /health
```
Response:
```json
{
  "status": "ok",
  "message": "API и БД работают"
}
```

### Получить компании
```
GET /api/companies?city=Москва&category=Кафе&has_email=true&limit=50&offset=0
```

**Query Parameters:**
- `city` (str) — фильтр по городу (ILIKE)
- `category` (str) — фильтр по категории
- `has_email` (bool) — только с email
- `has_phone` (bool) — только с телефоном
- `has_website` (bool) — только с сайтом
- `limit` (int, default 50) — количество результатов
- `offset` (int, default 0) — смещение

Response:
```json
{
  "total": 1234,
  "limit": 50,
  "offset": 0,
  "data": [
    {
      "id": 123,
      "name": "Кафе Парадиз",
      "city": "Москва",
      "domain": "cafe-paradiz.ru",
      "website": "http://cafe-paradiz.ru",
      "phone": "+7-999-123-45-67",
      "email": "info@cafe-paradiz.ru",
      "categories": "Питание, Кафе, Сладкое"
    }
  ]
}
```

### Получить компанию подробно
```
GET /api/companies/123
```
Response:
```json
{
  "company": {
    "id": 123,
    "name": "Кафе Парадиз",
    "city": "Москва",
    "domain": "cafe-paradiz.ru",
    "website": "http://cafe-paradiz.ru",
    "created_at": "2024-01-15T10:30:00"
  },
  "branches": [
    {
      "id": 1,
      "address": "ул. Ленина, д. 10",
      "postal_code": "119991",
      "working_hours": "пн-вс: 10:00 - 22:00",
      "phones": ["+7-999-123-45-67"]
    }
  ],
  "emails": ["info@cafe-paradiz.ru"],
  "categories": [{"name": "Кафе", "parent_id": null}],
  "socials": {
    "v": "https://vk.com/cafe_paradiz",
    "a": "https://facebook.com/cafe.paradiz"
  }
}
```

### Экспорт в CSV
```
GET /api/export?city=Москва&category=Кафе&limit=5000
```
Возвращает CSV файл: `dbgis_export_20240315_143022.csv`

Колонки:
```
ID,Название,Город,Домен,Сайт,Телефон,Email,Категории
123,"Кафе Парадиз","Москва","cafe-paradiz.ru","http://cafe-paradiz.ru","+7-999-123-45-67","info@cafe-paradiz.ru","Питание, Кафе"
```

---

## 🔧 Конфигурация

`.env` файл:

```env
# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=dbgis
DB_USER=postgres
DB_PASSWORD=your_password

# FastAPI
API_HOST=0.0.0.0
API_PORT=8000
DEBUG=False

# Миграция
SQLITE_PATH=../dgdat2xlsx/data/local.db
```

---

## 📊 Примеры использования

### Поиск кафе в Москве (с сайтом)
```
http://localhost:8000/?city=Москва&category=Кафе&has_website=on
```

### API: Все компании без требований
```bash
curl "http://localhost:8000/api/companies?limit=100"
```

### API: Компании с email и сайтом
```bash
curl "http://localhost:8000/api/companies?has_email=true&has_website=true&limit=50"
```

### Скачать всё для Петербурга
```bash
curl "http://localhost:8000/api/export?city=Санкт-Петербург&limit=10000" > spb_companies.csv
```

---

## 🚀 Production Deployment

### Gunicorn + Nginx
```bash
pip install gunicorn
gunicorn main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

### Systemd Service (Linux)
Создайте `/etc/systemd/system/dbgis.service`:
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

Включить и запустить:
```bash
sudo systemctl enable dbgis
sudo systemctl start dbgis
```

---

## 🐛 Debug

### Ошибка подключения к БД
```bash
# Проверьте, запущен ли PostgreSQL
psql -U postgres -c "SELECT 1"

# Проверьте .env параметры
cat .env | grep DB_
```

### Проверка БД
```bash
psql -U postgres -d dbgis

# В psql:
SELECT COUNT(*) FROM companies;
SELECT COUNT(*) FROM categories;
```

### Логи FastAPI
```bash
# С DEBUG=True в .env будут подробные логи
python main.py
```

---

## 📚 Документация

- [API Schema](http://localhost:8000/docs) — Swagger UI (автоматически)
- [Альтернативная документация](http://localhost:8000/redoc) — ReDoc
- [PostgreSQL Docs](https://www.postgresql.org/docs/)
- [FastAPI Tutorial](https://fastapi.tiangolo.com/)

---

## 🤝 Интеграция с dgdat2xlsx

Проект полностью синхронизирован с `dgdat2xlsx`:
- Схема БД совпадает с `import_db.py`
- Миграция читает из SQLite базы (`dgdat2xlsx/data/local.db`)
- Одна команда: `python migrate_sqlite_to_postgres.py`

---

## 📝 License

Этот проект использует алгоритмы из [DgdatToXlsx](https://github.com/mbry/DgdatToXlsx).

---

## 🎯 Что дальше?

- ✅ Основной backend готов
- ✅ Web интерфейс работает
- ✅ CSV экспорт готов

**Идеи для расширения:**
- [ ] Кеширование Redis
- [ ] Аутентификация (JWT)
- [ ] История поисков
- [ ] Сохраненные фильтры
- [ ] Расширенные статистики
- [ ] Интеграция с Telegram Bot API
- [ ] Mobile app (React Native)

---

**Успехов!** 🚀
