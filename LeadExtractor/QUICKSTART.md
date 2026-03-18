# 🚀 Quickstart Guide

## Быстрый старт LeadExtractor MVP

### 1️⃣ Backend запуск (Terminal 1)

```bash
cd /home/user/ai/LeadExtractor/backend
pip install -r requirements.txt
uvicorn main:app --reload
```

✅ Будет доступен на: http://localhost:8000

Проверить здоровье:
```bash
curl http://localhost:8000/api/health
```

### 2️⃣ Frontend запуск (Terminal 2)

```bash
cd /home/user/ai/LeadExtractor/frontend
npm install
npm run dev
```

✅ Будет доступен на: http://localhost:5173

### 3️⃣ Использование

1. Откройте браузер: http://localhost:5173
2. Вставьте URL в textarea:
   ```
   github.com
   google.com
   ```
3. Нажмите "Find Contacts"
4. Посмотрите результаты в таблице
5. Нажмите "Export CSV" для скачивания

---

## 📁 Структура проекта

```
LeadExtractor/
├── backend/                      # FastAPI приложение
│   ├── main.py                   # Основное приложение + API endpoints
│   ├── crawler.py                # Crawl4AI интеграция
│   ├── extractors.py             # Email/Phone extraction
│   ├── requirements.txt           # Python зависимости
│   └── .gitignore
│
├── frontend/                      # React приложение
│   ├── src/
│   │   ├── App.jsx               # Главный компонент
│   │   ├── api.js                # HTTP клиент
│   │   ├── main.jsx              # React entry point
│   │   ├── index.css             # Tailwind стили
│   │   └── components/
│   │       ├── Header.jsx        # Шапка с навигацией
│   │       └── ResultsTable.jsx  # Таблица результатов
│   ├── index.html                # HTML template
│   ├── package.json              # Node.js зависимости
│   ├── vite.config.js            # Vite конфигурация
│   ├── tailwind.config.js        # Tailwind конфигурация
│   ├── postcss.config.js         # PostCSS конфигурация
│   └── .gitignore
│
├── README.md                      # Полная документация
├── QUICKSTART.md                  # Этот файл
├── CLAUDE.md                      # Требования проекта
└── LeadExtractor.html             # Эталон дизайна
```

---

## 🛠️ Технологический стек

### Frontend
- **React 18.2.0** - UI framework
- **Vite 5.0** - Build tool
- **Tailwind CSS 3.3** - Styling
- **Axios 1.6** - HTTP client

### Backend
- **FastAPI 0.104** - Web framework
- **Uvicorn 0.24** - ASGI server
- **Crawl4AI 0.4+** - Web crawler
- **phonenumbers 8.13** - Phone number parsing

---

## 🔄 API Endpoints

### POST /api/extract

Извлечь контакты из списка URL.

**Request:**
```bash
curl -X POST http://localhost:8000/api/extract \
  -H "Content-Type: application/json" \
  -d '{
    "urls": ["example.com", "github.com"]
  }'
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

### GET /api/health

Проверить статус API.

```bash
curl http://localhost:8000/api/health
```

---

## 🎯 Особенности MVP

✅ **Асинхронная обработка** - все URL обрабатываются параллельно
✅ **Умный краулинг** - автоматический поиск contact/about/team страниц
✅ **Email extraction** - регулярные выражения для email
✅ **Phone extraction** - phonenumbers library для телефонов
✅ **CSV export** - прямое скачивание результатов
✅ **Минималистичный UI** - светлая тема, простая таблица
✅ **CORS включен** - frontend может общаться с backend

---

## 📊 Ограничения MVP

⚠️ Максимум **5 страниц** на сайт
⚠️ Максимум **5 email** на сайт
⚠️ Максимум **3 телефона** на сайт
⚠️ Timeout **15 секунд** на страницу
⚠️ **Нет базы данных** (все в памяти)
⚠️ **Нет аутентификации**

---

## 🐛 Troubleshooting

### Backend не стартует

```bash
# Проверить Python версию (требуется 3.8+)
python --version

# Переустановить зависимости
pip install --upgrade pip
pip install -r requirements.txt

# Очистить кэш
python -m pip cache purge
```

### Frontend не работает с Backend

```bash
# Проверить CORS в browser console (F12)
# Убедиться что Backend запущен на localhost:8000

# Перезагрузить frontend
npm run dev
```

### Crawl4AI ошибки

```bash
# Переустановить crawl4ai с правильной версией
pip install --upgrade crawl4ai
```

---

## 📝 Примеры URL для тестирования

```
github.com
google.com
amazon.com
example.com
startup.io
```

---

## 🚀 Следующие шаги (Future)

- [ ] PostgreSQL база данных
- [ ] Job queue для длинных операций
- [ ] Сохранение истории поиска
- [ ] JavaScript rendering (Playwright)
- [ ] API ключи и rate limiting
- [ ] CSV импорт
- [ ] Фильтрация и сортировка результатов
- [ ] Пользовательские профили

---

## 📄 Лицензия

MIT

---

**Created:** 2025-03-18
**Status:** MVP / Production Ready
