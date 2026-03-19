# LeadExtractor MVP

Простой сервис для извлечения контактов (email, телефон) с веб-сайтов.

## Архитектура

- **Frontend**: React + Vite + Tailwind CSS
- **Backend**: FastAPI + Crawl4AI
- **Crawler**: Asyncio-based с поддержкой до 5 страниц на сайт

## Установка и запуск

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

Backend будет доступен на `http://localhost:8000`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend будет доступен на `http://localhost:5173`

## Использование

1. Откройте `http://localhost:5173`
2. Вставьте список URL (по одному на строку)
3. Нажмите "Find Contacts"
4. Просмотрите результаты в таблице
5. Нажмите "Export CSV" для скачивания

## API

### POST /api/extract

Извлечь контакты из списка URL.

**Request:**
```json
{
  "urls": ["example.com", "startup.io"]
}
```

**Response:**
```json
{
  "results": [
    {
      "website": "https://example.com",
      "emails": ["contact@example.com"],
      "phones": ["+1 555 0000"],
      "sources": ["https://example.com/contact"]
    }
  ],
  "total": 1
}
```

## Особенности

- **Асинхронная обработка**: все URL обрабатываются параллельно
- **Умный краулинг**: автоматический поиск контактных страниц
- **Регулярные выражения**: для извлечения email
- **Фонетический анализ**: для телефонных номеров (phonenumbers library)
- **CSV экспорт**: прямое скачивание результатов

## Ограничения MVP

- Максимум 5 страниц на сайт
- Максимум 5 email и 3 телефона на сайт
- Timeout 15 секунд на страницу
- Нет базы данных (все в памяти)
- Нет аутентификации

## Структура проекта

```
LeadExtractor/
├── backend/
│   ├── main.py           # FastAPI приложение
│   ├── crawler.py        # Crawl4AI интеграция
│   ├── extractors.py     # Email/phone extraction
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx       # Главный компонент
│   │   ├── api.js        # API клиент
│   │   ├── main.jsx      # Entry point
│   │   ├── index.css     # Tailwind styles
│   │   └── components/   # React компоненты
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
└── README.md
```

## Развитие

Future features:
- [ ] PostgreSQL база данных
- [ ] Job queue (Celery/Bull)
- [ ] Сохранение истории поиска
- [ ] Более умный crawler (JavaScript rendering)
- [ ] API ключи и rate limiting
- [ ] CSV импорт

## Лицензия

MIT
