# 🚀 Beem Video AI - Setup Guide

Полная архитектура: **Astro сервер + Telegram-бот (FastAPI)**

## 📋 Quick Start

### Terminal 1: Запуск Astro

```bash
cd ai/astro
npm install
npm run dev
# http://localhost:3000
```

### Terminal 2: Запуск Telegram-бота

```bash
cd ai/nexus_bot

# Первый раз - создаём venv и устанавливаем зависимости
python -m venv venv
source venv/bin/activate  # или `venv\Scripts\activate` на Windows
pip install -r requirements.txt

# Копируем .env
cp .env.example .env

# Отредактируй .env с твоим Telegram Bot Token:
# TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
# BEEM_BASE_URL=http://localhost:3000 (если Astro на dev)

# Запускаем бота
uvicorn main:app --reload --port 8000
# http://localhost:8000
```

## 🏗️ Архитектура

```
┌─────────────┐
│  Telegram   │
└──────┬──────┘
       │
┌──────▼────────────────┐
│ FastAPI Bot Server    │  ← ai/nexus_bot:8000
│ (aiogram + polling)   │
└──────┬────────────────┘
       │ HTTP POST
       ▼
┌──────────────────────┐
│ Astro Web Server     │  ← ai/astro:3000/4321
│ - API                │
│ - UI                 │
│ - MiniMax pipeline   │
│ - Queue              │
│ - DB (SQLite)        │
└─────────────────────┘
```

## 📁 Структура

```
ai/
├── astro/                    # Astro сервер (Node.js)
│   ├── src/
│   │   ├── pages/          # HTTP endpoints
│   │   ├── lib/            # Utilities
│   │   └── middleware.ts   # Auth middleware
│   ├── package.json        # NO grammy, NO axios
│   ├── astro.config.mjs    # Чистый (no bot externals)
│   └── dist/               # Production build
│
└── nexus_bot/              # Telegram-бот (Python)
    ├── main.py             # FastAPI + lifespan
    ├── bot.py              # aiogram бот (FSM)
    ├── state.py            # State management
    ├── api.py              # HTTP клиент к Astro
    ├── requirements.txt    # fastapi, aiogram, etc
    ├── .env.example        # Конфиг
    └── README.md           # Документация
```

## 🔧 Конфигурация

### ai/nexus_bot/.env

```env
# Telegram Bot Token (из @BotFather)
TELEGRAM_BOT_TOKEN=YOUR_TOKEN_HERE

# Astro API URL
BEEM_BASE_URL=http://localhost:3000

# FastAPI порт
BOT_PORT=8000
```

## ✅ Проверка

```bash
# Astro
curl http://localhost:3000/          # Should return HTML
curl http://localhost:3000/api/       # Should return JSON

# Telegram-бот
curl http://localhost:8000/           # Should return {"status": "ok"}
curl http://localhost:8000/health     # Should return {"status": "healthy"}
```

## 📊 Жизненный цикл запроса

1. **Пользователь в Telegram** → `/start`
2. **Бот (FastAPI)** → Показывает UI
3. **Пользователь** → Загружает фото
4. **Бот (FastAPI)** → Сохраняет фото локально
5. **Пользователь** → Пишет промпт
6. **Бот (FastAPI)** → POST `/api/telegram/generate`
7. **Astro API** → Запускает MiniMax генерацию
8. **Бот (FastAPI)** → Polling GET `/api/telegram/status`
9. **Когда готово** → Скачивает видео
10. **Отправляет видео** → В Telegram пользователю

## 🛠️ Production Deployment

### Docker Compose

```yaml
version: '3'
services:
  astro:
    build: ./astro
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production

  bot:
    build: ./nexus_bot
    ports:
      - "8000:8000"
    environment:
      - TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN}
      - BEEM_BASE_URL=http://astro:3000
```

### systemd (для бота)

```ini
[Unit]
Description=Beem Telegram Bot
After=network.target

[Service]
Type=simple
User=beem
WorkingDirectory=/home/beem/ai/nexus_bot
Environment="TELEGRAM_BOT_TOKEN=YOUR_TOKEN"
Environment="BEEM_BASE_URL=http://localhost:3000"
ExecStart=/home/beem/ai/nexus_bot/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000

Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

## ❌ Проблемы

| Ошибка | Решение |
|--------|---------|
| `Connection refused localhost:3000` | Запусти Astro в Terminal 1 |
| `TELEGRAM_BOT_TOKEN не установлен` | Добавь токен в .env |
| `aiohttp` module not found | `pip install -r requirements.txt` |
| `Astro build fails` | `npm install` и переcheck astro.config.mjs |

## 📖 Дальше

- **ai/astro/README.md** - Astro документация
- **ai/nexus_bot/README.md** - Бот документация
- **Telegram @BotFather** - Создание bot token

## 🎯 Результат

✅ Чистый Astro (no grammy, no webpack conflicts)
✅ Независимый Telegram-бот
✅ Легко масштабировать
✅ Production-ready архитектура
✅ Два отдельных процесса
