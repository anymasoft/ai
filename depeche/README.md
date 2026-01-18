# Depeche - AI Article Editor

FastAPI-сервер с LLM интеграцией для генерации планов статей и хранением в SQLite.

## Структура проекта

```
depeche/
├─ main.py                 # FastAPI приложение + API endpoints
├─ database.py             # Работа с SQLite
├─ llm.py                  # Интеграция с OpenAI LLM
├─ __init__.py             # Python пакет
├─ templates/
│  └─ index.html           # HTML UI (Pixel Bootstrap)
├─ static/                 # Статические файлы (CSS, JS, images)
├─ depeche.db              # SQLite база (создаётся автоматически)
├─ .env.example            # Пример конфига (переименовать в .env)
├─ requirements.txt        # Зависимости Python
└─ README.md               # Этот файл
```

## Установка

### 1. Установить зависимости

```bash
cd depeche
pip install -r requirements.txt
```

### 2. Создать файл .env

Скопируй `.env.example` в `.env` и добавь свой OpenAI API key:

```bash
cp .env.example .env
```

Отредактируй `.env`:

```
OPENAI_API_KEY=sk-xxx...
OPENAI_MODEL=gpt-4o-mini
OPENAI_TEMPERATURE=0.3
OPENAI_MAX_TOKENS=200
DATABASE_URL=sqlite:///depeche.db
```

## Запуск сервера

```bash
python main.py
```

Или через uvicorn с hot reload:

```bash
uvicorn main:app --reload
```

Сервер запустится на: **http://localhost:8000/**

## API Endpoints

### Создать новую статью (генерация плана через LLM)

```
POST /api/articles
Content-Type: application/json

{
  "topic": "Обезьяны в Африке"
}
```

Response:
```json
{
  "id": 1,
  "title": "Обезьяны в Африке",
  "content": "1. Виды обезьян...\n2. Среда обитания...\n..."
}
```

### Получить список статей (для sidebar)

```
GET /api/articles
```

Response:
```json
[
  { "id": 1, "title": "Обезьяны в Африке" },
  { "id": 2, "title": "..." }
]
```

### Получить конкретную статью

```
GET /api/articles/{id}
```

Response:
```json
{
  "id": 1,
  "title": "Обезьяны в Африке",
  "content": "1. ...\n2. ...\n..."
}
```

### Удалить статью

```
DELETE /api/articles/{id}
```

Response:
```json
{
  "success": true,
  "message": "Статья удалена"
}
```

## Тестирование

Проверить что сервер работает:

```bash
curl http://localhost:8000/health
```

Ответ: `{"status":"ok","app":"Depeche"}`

## Архитектура

- **main.py** — FastAPI приложение, маршруты, CORS middleware
- **database.py** — SQLite операции (CRUD для articles)
- **llm.py** — Интеграция с OpenAI для генерации плана статьи
- **templates/index.html** — Фронтенд (Pixel Bootstrap)

## Как работает процесс

1. Пользователь вводит тему статьи в UI
2. Фронтенд отправляет POST /api/articles с темой
3. Backend вызывает OpenAI LLM для генерации плана
4. План сохраняется в SQLite
5. Фронтенд получает статью и отображает её
6. При переключении статей фронтенд делает GET /api/articles/{id}
