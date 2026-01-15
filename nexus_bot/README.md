# 🤖 Beem Telegram Bot (Независимый видео-движок)

Полностью автономный Telegram-бот для генерации видео. **Не требует Astro сервера**.

## 🎯 Архитектура

```
Telegram
   ↓
FastAPI Bot Server (nexus_bot) на aiogram
   ├─ Telegram UI + FSM
   └─ Встроенный Video Engine:
      ├─ Smart Prompt Enhancer (GPT-4o-mini)
      ├─ Camera Director (cinematic commands)
      ├─ MiniMax API Client (генерация видео)
      ├─ Queue System (обработка one-by-one)
      └─ Status Tracking (in-memory)
```

## ✨ Ключевые особенности

✅ **Полностью независимый** - не требует Astro сервера
✅ **Smart Prompt Enhancement** - улучшение промптов через GPT-4o-mini
✅ **Cinematic Camera Directions** - автоматический выбор camera commands
✅ **PRESERVE Constraints** - соблюдение ограничений при генерации видео
✅ **Queue Processing** - очередь с concurrency=1
✅ **Async/await** - полностью асинхронная архитектура
✅ **Production-ready** - логирование, обработка ошибок, timeouts

## 📁 Структура

```
nexus_bot/
├── core/                      # Video Engine (сердце проекта)
│   ├── prompts.py            # Smart Prompt Enhancer (Фаза 1)
│   ├── director.py           # Camera Director (Фаза 2)
│   ├── minimax.py            # MiniMax API Client
│   ├── queue.py              # Queue System
│   ├── video_engine.py       # Оркестратор (Фаза 3-5)
│   └── __init__.py
│
├── main.py                    # FastAPI + lifespan (запуск engine + bot)
├── bot.py                     # Telegram UI (aiogram)
├── state.py                   # User State Management
├── requirements.txt           # Dependencies
├── .env.example              # Config template
└── README.md                 # This file
```

## 🚀 Быстрый старт

### 1. Установка

```bash
cd ai/nexus_bot

# Создаём virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Устанавливаем зависимости
pip install -r requirements.txt
```

### 2. Конфигурация

```bash
cp .env.example .env
```

Отредактируй `.env` и добавь ключи:

```env
# Telegram Bot Token (@BotFather)
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11

# OpenAI (для Smart Prompt Enhancer)
OPENAI_API_KEY=sk-...

# MiniMax (для видео-генерации)
MINIMAX_API_KEY=your-minimax-key

# Callback URL
MINIMAX_CALLBACK_URL=https://your-server.com/minimax_callback
```

### 3. Запуск

```bash
uvicorn main:app --reload --port 8000
```

Бот будет готов на: **http://localhost:8000**

## 🎯 Пайплайн генерации видео

```
1. Пользователь → /start
   ↓
2. Загружает фото
   → Сохраняется локально в /tmp/telegram-bot/photo_<USER_ID>.jpg
   ↓
3. Пишет промпт (на русском)
   ↓
4. Нажимает "Сгенерировать"
   ↓
5. [ENGINE ФАЗА 1] Smart Prompt Enhancement
   → GPT-4o-mini улучшает промпт
   → Обнаруживает PRESERVE constraints
   → Результат: prompt_cinematic
   ↓
6. [ENGINE ФАЗА 2] Camera Director Compilation
   → GPT-4o-mini генерирует camera commands
   → Валидирует 15 допустимых MiniMax команд
   → Если PRESERVE → ТОЛЬКО [Static shot]
   → Результат: prompt_director
   ↓
7. [ENGINE ФАЗА 3] Очередь
   → Добавляется в очередь (concurrency=1)
   → Обработчик берёт из очереди
   ↓
8. [ENGINE ФАЗА 4] MiniMax API Call
   → POST /video_generation
   → Отправляет фото + prompt_director + duration
   → Получает generation_id
   ↓
9. [ENGINE ФАЗА 5] Polling
   → GET /video_generation?task_id=gen_id
   → Ждёт пока status == "done"
   → Максимум 2 минуты (120 сек)
   ↓
10. [ENGINE ФАЗА 6] Download
    → Скачивает видео по URL
    → Сохраняет в /tmp/beem-videos/
    ↓
11. Telegram Bot
    → Отправляет видео пользователю
    → Предлагает создать ещё одно
```

## 📊 Логирование

Все события логируются в консоль с префиксами:

```
[ENGINE] generation_initiated          # Начало генерации
[ENGINE] prompt_enhanced               # Фаза 1 готова
[ENGINE] camera_selected               # Фаза 2 готова
[ENGINE] minimax_request               # Фаза 3 запрос отправлен
[ENGINE] minimax_done                  # Фаза 4 результат получен
[ENGINE] Generation complete           # Фаза 6 видео готово

[TG] user_start                        # Пользователь начал
[TG] user_uploaded_photo               # Фото загружено
[TG] user_sent_prompt                  # Промпт отправлен
[TG] generation_started                # Генерация началась
[TG] generation_polling                # Checking status
[TG] generation_complete               # Видео готово
```

## 🔧 Components

### 1. **prompts.py** - Smart Prompt Enhancer

```python
enhanced = await prompt_enhancer.enhance_prompt(text, mode="prompt")
```

- Переводит русский текст в английский
- Добавляет cinematic детали
- Обнаруживает и сохраняет PRESERVE constraints
- Timeout: 10 сек

### 2. **director.py** - Camera Director

```python
cinematic = await camera_director.compile(enhanced)
```

- Генерирует camera movement commands через GPT
- Валидирует 15 MiniMax команд
- Если PRESERVE → ТОЛЬКО [Static shot]
- Санитизирует невалидные команды
- Timeout: 12 сек

### 3. **minimax.py** - MiniMax API Client

```python
result = await minimax_client.generate_from_prompt(photo_path, prompt, 6)
status = await minimax_client.get_generation_status(gen_id)
await minimax_client.download_video(url, output_path)
```

- Отправляет запросы к MiniMax
- Получает статус генерации
- Скачивает видео

### 4. **queue.py** - Queue System

```python
await queue.enqueue(item)
item = await queue.dequeue()
```

- FIFO очередь
- concurrency = 1 (только одна генерация одновременно)
- Async-safe (использует asyncio.Lock)

### 5. **video_engine.py** - Оркестратор

```python
result = await video_engine.generate_video(user_id, photo_path, prompt, 6)
status = video_engine.get_generation_status(gen_id)
video_path = video_engine.get_generation_video_path(gen_id)
```

- Координирует все фазы
- Управляет очередью
- Хранит статус всех генераций

## 🔐 Environment Variables

**Обязательные:**
- `TELEGRAM_BOT_TOKEN` - Token от @BotFather
- `OPENAI_API_KEY` - OpenAI API key
- `MINIMAX_API_KEY` - MiniMax API key

**Опциональные:**
- `BOT_PORT` - Порт FastAPI (default: 8000)
- `MINIMAX_CALLBACK_URL` - Callback URL для MiniMax

## 📊 Health Check

```bash
curl http://localhost:8000/
curl http://localhost:8000/health
curl http://localhost:8000/debug/state
```

## 🛠️ Development

### Adding New Features

1. Логика идёт в `core/` компоненты
2. UI обновляется в `bot.py`
3. Тестируй локально с `uvicorn main:app --reload`

### Debugging

```python
# Смотри логи в консоли
[ENGINE] ...
[TG] ...
```

## ⚡ Production Deployment

### Docker

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### systemd

```ini
[Unit]
Description=Beem Telegram Bot
After=network.target

[Service]
Type=simple
User=beem
WorkingDirectory=/home/beem/ai/nexus_bot
Environment="TELEGRAM_BOT_TOKEN=YOUR_TOKEN"
Environment="OPENAI_API_KEY=YOUR_KEY"
Environment="MINIMAX_API_KEY=YOUR_KEY"
ExecStart=/home/beem/ai/nexus_bot/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000

Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

## 📄 License

Internal Use Only - Beem Video AI

## 🎯 Roadmap

- ✅ Telegram UI
- ✅ Smart Prompt Enhancer
- ✅ Camera Director
- ✅ MiniMax Integration
- ✅ Queue System
- 🔄 Database для истории генераций
- 🔄 Payment integration
- 🔄 User statistics
- 🔄 Advanced analytics

## 📞 Support

Все проблемы логируются в консоль с префиксом `[ENGINE]` или `[TG]`.

Проверь:
1. TELEGRAM_BOT_TOKEN установлен
2. OPENAI_API_KEY валиден
3. MINIMAX_API_KEY валиден
4. MINIMAX_CALLBACK_URL доступен
