# CLAUDE.md — Правила проекта dgdat2xlsx

## Бизнес-цель (ГЛАВНЫЙ ПРИОРИТЕТ)

Проект — инструмент для поиска **бизнес-лидов** и их контактной информации.
Ключевые данные, которые ни в коем случае нельзя терять:

1. **Сайты / домены** — прямая бизнес-ценность
2. **Email-адреса** — прямая бизнес-ценность
3. **Номера телефонов** — прямая бизнес-ценность
4. **Соцсети / мессенджеры** (Telegram, VK и пр.) — дополнительная ценность

### Принципы работы с контактными данными
- **Не терять** — каждый контакт из dgdat должен дойти до PostgreSQL
- **Не искажать** — URL хранить как есть (без .lower() на путях, без склеивания)
- **Нормализовать** — убирать мусорные обёртки (link.2gis.ru, max.ru), UTM-параметры,
  дедуплицировать по домену, но оригинальные URL всегда сохранять
- **Не фильтровать сомнительные** — лучше сохранить лишний контакт, чем потерять настоящий
- В дальнейшем планируется обогащение лидов дополнительными данными

## Обзор
Проект: парсинг бинарных файлов 2ГИС (.dgdat) → XLSX → SQLite → PostgreSQL → API.
Язык: Python 3.10+. Зависимости: openpyxl (requirements.txt).

## Структура
```
dgdat2xlsx/
├── convert.py       # dgdat → xlsx (парсинг бинарных данных)
├── import_db.py     # xlsx → sqlite (нормализованная БД)
├── debug_contacts.py # диагностика типов контактов в dgdat
├── download/        # входные .dgdat файлы
├── output/          # выходные .xlsx (генерируются convert.py)
├── data/            # SQLite БД (генерируется import_db.py)
└── requirements.txt # openpyxl

dbgis-backend/
├── main.py                        # FastAPI + API + Web UI
├── schema.sql                     # PostgreSQL-схема (8 таблиц)
├── migrate_sqlite_to_postgres.py  # SQLite → PostgreSQL (сохраняет id!)
├── templates/index.html           # Web UI (Tailwind CSS)
├── requirements.txt               # fastapi, psycopg2, etc.
└── .env.example                   # конфигурация подключения
```

## Полный пайплайн
```
dgdat → convert.py → XLSX → import_db.py → SQLite → migrate_sqlite_to_postgres.py → PostgreSQL → FastAPI API + Web UI
```

## Ключевые правила

### Архитектура данных
- **dgdat** — единственный источник истины
- **xlsx** — точная копия dgdat; при расхождении — полная перезапись
- **SQLite** — нормализованное представление xlsx; импорт идемпотентен
- **PostgreSQL** — production БД; миграция сохраняет оригинальные id из SQLite
- Контактная информация не должна теряться ни на одном этапе пайплайна

### Нормализация URL
- Обёртки 2GIS (link.2gis.ru, max.ru, go.2gis.com) → разворачиваются до реального URL
- UTM-параметры (utm_source, utm_medium и пр.) → удаляются
- Дедупликация по домену (www.site.ru = site.ru) → оставляется первый URL
- `.lower()` только для доменов и email, НЕ для полных URL (пути case-sensitive)
- В поле `website` хранятся все URL через \n, в поле `domain` — все домены через запятую

### Кодирование
- Язык комментариев и вывода: **русский**
- Стиль: PEP 8, но без излишнего усложнения
- Зависимости: только stdlib + openpyxl. Не добавлять pandas, sqlalchemy и пр.
- Транзакции: все операции с БД в транзакциях (commit после каждого файла)
- Идемпотентность: INSERT OR IGNORE / ON CONFLICT, проверка перед записью
- Никаких ORM — чистый sqlite3 / psycopg2

### Колонки XLSX (24 шт., порядок фиксирован)
ID, Название организации, Населенный пункт, Раздел, Подраздел, Рубрика,
Телефоны, Факсы, Email, Сайт, Адрес, Почтовый индекс, Типы платежей,
Время работы, Собственное название строения, Назначение строения,
Vkontakte, Facebook, Skype, Twitter, Instagram, ICQ, Jabber, Telegram

### Схема БД (8 таблиц)
companies, company_aliases, branches, phones, emails, socials, categories, company_categories

### Категории
- Поля: Раздел → Подраздел → Рубрика (иерархия parent_id)
- Разделители: \n (несколько значений), / (вложенность)

### Что НЕ делать
- Не терять контактную информацию (сайты, email, телефоны, соцсети)
- Не менять порядок/названия колонок XLSX
- Не добавлять зависимости без крайней необходимости
- Не использовать инкрементальное обновление xlsx (только полная перезапись)
- Не хранить data/ и output/ в git
- Не применять .lower() к полным URL (только к доменам и email)
- Не склеивать несколько URL в одну строку через пробел (использовать \n)

---

## Полный pipeline системы

```
2GIS (.dgdat) → convert.py → XLSX (24 колонки)
  → import_db.py → SQLite (data/local.db)
    → dbgis-backend/migrate_sqlite_to_postgres.py → PostgreSQL
      → dbgis-backend/main.py (FastAPI API + Web UI)
        → dbgis-backend/enrich.py (обогащение через EXTRACTOR)
```

### Связанные проекты
| Проект | Путь | Назначение |
|--------|------|------------|
| dgdat2xlsx | `.` (текущий) | Парсинг 2ГИС .dgdat → XLSX → SQLite |
| dbgis-backend | `../dbgis-backend/` | FastAPI API + PostgreSQL + Web UI + enrich |
| EXTRACTOR | `../EXTRACTOR/` | Извлечение контактов с сайтов (email, phone) |

### Критичные зависимости
- `data/local.db` — SQLite БД, используется `dbgis-backend/migrate_sqlite_to_postgres.py`
- Путь конфигурируется через env `SQLITE_PATH` (default: `../dgdat2xlsx/data/local.db`)
- **Сохранение id**: PostgreSQL использует те же id что и SQLite (не автогенерация)
