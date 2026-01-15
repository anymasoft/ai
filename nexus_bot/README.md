# 🤖 Beem Telegram Bot (FastAPI)

Отдельный Telegram-бот сервер для Beem Video AI.

## 🏗️ Архитектура

```
Telegram
   ↓
FastAPI Bot Server (nexus_bot) на aiogram
   ↓
HTTP POST /api/telegram/generate
   ↓
Astro API (ai/astro)
   ↓
MiniMax Video Generation
   ↓
GET /api/telegram/status + polling
   ↓
FastAPI Bot Server
   ↓
sendVideo() в Telegram
```

## 🚀 Быстрый старт

### 1. Установка

```bash
cd ai/nexus_bot
python -m venv venv
source venv/bin/activate  # или `venv\Scripts\activate` на Windows
pip install -r requirements.txt
```

### 2. Конфигурация

Скопируй `.env.example` в `.env`:

```bash
cp .env.example .env
```

Отредактируй `.env`:

```env
# Telegram Bot Token (от @BotFather в Telegram)
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11

# Beem API URL (где запущен Astro server)
BEEM_BASE_URL=http://localhost:4321

# FastAPI сервер порт
BOT_PORT=8000
```

### 3. Запуск

```bash
# Убедись что Astro сервер запущен:
# cd ai/astro && npm run dev

# В отдельном терминале:
cd ai/nexus_bot
uvicorn main:app --reload --port 8000
```

Бот будет готов на: **http://localhost:8000**

## 📁 Файлы

- **`main.py`** - FastAPI приложение с lifespan (старт бота)
- **`bot.py`** - Aiogram Telegram-бот с FSM и обработчиками
- **`state.py`** - In-memory state management для пользователей
- **`api.py`** - Async HTTP клиент к Beem API
- **`requirements.txt`** - Python зависимости
- **`.env.example`** - Пример конфигурации

## 🔄 Жизненный цикл запроса

1. **Пользователь отправляет /start** → `cmd_start()`
2. **Загружает фото** → `msg_photo()` → сохраняется локально
3. **Пишет промпт** → `msg_prompt()` → валидация
4. **Нажимает "Сгенерировать"** → `cb_confirm_generate()`
   - POST `/api/telegram/generate` в Astro
   - Получаем `generationId`
   - Polling: `GET /api/telegram/status`
   - Когда `status=done` → скачиваем видео
   - Отправляем видео в Telegram

## 🎯 Endpoints

### Health Check

```bash
GET http://localhost:8000/
GET http://localhost:8000/health
```

### Debug (только для разработки)

```bash
GET http://localhost:8000/debug/state
```

## 🔧 State Management

State хранится в памяти (in-memory):

```python
UserState = {
    step: "waiting_photo" | "waiting_prompt" | "confirm" | "generating",
    photo_file_id: str,
    photo_path: str,
    prompt_text: str,
    last_generation_id: str,
    last_generation_status: str,
    last_update: datetime
}
```

**Автоочистка**: Состояния старше 3 часов удаляются автоматически.

## 🛡️ Ошибки

| Ошибка | Решение |
|--------|---------|
| `TELEGRAM_BOT_TOKEN не установлен` | Добавь токен в `.env` |
| `Connection refused на localhost:4321` | Убедись что Astro запущен |
| `[Errno 111] Connection refused` | Astro сервер не отвечает |

## 📊 Логирование

Все события логируются в консоль:

```
[TELEGRAM-BOT] [BOT_START] user=123456
[TELEGRAM-BOT] [BOT_PHOTO_RECEIVED] user=123456
[TELEGRAM-BOT] [BOT_GENERATE_CLICK] user=123456
[TELEGRAM-API] Generation started: gen_xyz...
[TELEGRAM-BOT] [TG_STATUS] user=123456 status=processing
[TELEGRAM-BOT] [BOT_DONE] user=123456
```

## 🚀 Production

Для production используй:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1
```

Или с supervisor/systemd.

## 📦 Зависимости

- **fastapi** - Web фреймворк
- **uvicorn** - ASGI сервер
- **aiogram** - Telegram Bot API
- **aiohttp** - Async HTTP клиент
- **python-dotenv** - Загрузка .env файлов

## ✨ Готово

Бот полностью отделен от Astro и может масштабироваться независимо.

Оба сервера запускаются в отдельных процессах:

```bash
Terminal 1:  cd ai/astro && npm run dev
Terminal 2:  cd ai/nexus_bot && uvicorn main:app --reload
```
