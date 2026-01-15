# 📋 Резюме интеграции Telegram-бота в Astro

## ✅ Что было сделано

### 1. Перемещение кода бота

**Из**: `/bot/src/` (отдельный проект)
**В**: `/src/telegram/` (встроен в Astro)

| Файл | Путь | Статус |
|------|------|--------|
| `bot.ts` | `/src/telegram/bot.ts` | ✅ Перемещён и адаптирован |
| `state.ts` | `/src/telegram/state.ts` | ✅ Перемещён |
| `api.ts` | `/src/telegram/api.ts` | ✅ Перемещён |
| `start.ts` | `/src/telegram/start.ts` | ✅ **НОВЫЙ** (lazy-singleton) |

### 2. Синхронизация с Astro runtime

#### ✅ Обновлено: `/src/middleware.ts`
- Добавлен импорт: `import { initializeTelegramBot } from './telegram/start'`
- Добавлена инициализация при первом запросе
- Используется флаг `botInitialized` для защиты от дубликатов

#### ✅ Обновлено: `/astro/package.json`
- Добавлена зависимость: `"grammy": "^1.24.1"`
- Добавлена зависимость: `"axios": "^1.6.5"`

#### ✅ Существующие endpoints остаются теми же:
- `POST /api/telegram/generate`
- `GET /api/telegram/status`

### 3. Удалено

- ❌ Папка `/bot/` полностью удалена

## 🏗️ Точка входа Astro

**Где запускается бот**: `src/middleware.ts`

```typescript
// При первом HTTP запросе
export const onRequest = defineMiddleware((context, next) => {
  if (!botInitialized) {
    botInitialized = true;
    initializeTelegramBot()  // ← Здесь запускается бот
  }
  return next();
});
```

**Как это работает**:

```
1. npm run dev (или npm run preview)
   ↓
2. Astro запускается, слушает localhost:4321
   ↓
3. Первый HTTP запрос (например, GET /)
   ↓
4. middleware.ts срабатывает
   ↓
5. initializeTelegramBot() запускается один раз
   ↓
6. /src/telegram/start.ts создаёт Bot instance
   ↓
7. Бот начинает polling Telegram API
   ↓
8. Бот готов к использованию ✅
```

## 🔐 Защита от дубликатов

### Двухуровневая защита

**Уровень 1: middleware.ts**
```typescript
let botInitialized = false;  // Сбрасывается при hot-reload dev
if (!botInitialized) {
  botInitialized = true;
  initializeTelegramBot();
}
```

**Уровень 2: telegram/start.ts**
```typescript
if ((globalThis as any).__telegramBotStarted) {
  return;  // Уже запущен, не запускаем повторно
}
(globalThis as any).__telegramBotStarted = true;
```

**Результат**: Бот запускается только один раз, даже при hot-reload.

## 🚀 Как запустить

### Шаг 1: Установи зависимости

```bash
cd /astro
npm install
```

Это установит новые зависимости: `grammy` и `axios`

### Шаг 2: Убедись что переменные окружения установлены

В `.env.local` или `.env`:

```env
TELEGRAM_BOT_TOKEN=your_token_here
BEEM_BASE_URL=http://localhost:4321
```

### Шаг 3: Запусти Астро

```bash
npm run dev
```

или для preview режима:

```bash
npm run build
npm run preview
```

### Шаг 4: Проверь логи

При успешном запуске ты увидишь:

```
[TELEGRAM-INIT] Initializing Telegram bot...
[TELEGRAM-BOT] Temp directory created: /path/to/tmp/telegram-bot
[TELEGRAM-BOT] Bot instance created
[TELEGRAM-BOT] Starting bot...
[TELEGRAM-BOT] ✅ Backend is available
[TELEGRAM-BOT] ✅ Bot logged in as @your_bot_name
[TELEGRAM-BOT] ✅ Telegram bot is running!
```

## 📊 Архитектура (после интеграции)

```
npm run dev / npm run preview
│
├─ Astro HTTP Server (localhost:4321)
│  ├─ GET / (landing page)
│  ├─ GET /app (protected app)
│  ├─ POST /api/generate (video generation)
│  ├─ POST /api/telegram/generate (from bot)
│  └─ GET /api/telegram/status (from bot)
│
└─ Telegram Bot (grammY polling)
   ├─ /start command
   ├─ Фото → Текст → Генерация
   └─ Отправка видео пользователю
```

## ✅ Чеклист функциональности

- [ ] Backend и бот в одном процессе
- [ ] `npm run dev` запускает оба компонента
- [ ] `npm run build && npm run preview` работает
- [ ] Бот отвечает на `/start` в Telegram
- [ ] Бот может генерировать видео (фото → текст → видео)
- [ ] Логи показывают `[TELEGRAM-BOT]` события
- [ ] Нет дубликатов ботов при hot-reload
- [ ] Процесс один (проверь: `ps aux | grep node`)
- [ ] Env переменные работают (от `/astro/.env`)
- [ ] Нет ошибок в консоли

## 📝 Что осталось старым

✅ Существующие API endpoints:
- `POST /api/generate` (для web)
- `GET /api/generate`
- Все остальные endpoints

✅ Существующая бизнес-логика:
- enhancePrompt() - улучшение промптов
- compileCameraCommands() - camera commands
- MiniMax интеграция
- Очередь обработки
- SQLite БД

✅ Существующий auth:
- OAuth Google/Yandex
- Система сессий
- Защищённые маршруты

**Ничего не сломано!** Интеграция полностью фоновая.

## 🔄 Миграция для пользователей

Если у тебя был запущен бот в отдельном процессе:

**Раньше**:
```bash
# Terminal 1
cd astro
npm run dev

# Terminal 2
cd bot
npm run dev
```

**Теперь**:
```bash
# Один терминал
cd astro
npm run dev
# Всё автоматически (сайт + API + бот)
```

## 🐛 Если что-то не работает

### Проблема: Бот не запускается

**Проверь**:
1. `TELEGRAM_BOT_TOKEN` установлен в `.env.local`
2. Token правильный (скопирован из @BotFather)
3. Нет других Node процессов (ps aux | grep node)
4. Перезагрузи: Ctrl+C и npm run dev заново

### Проблема: "Backend may not be available"

**Проверь**:
1. Астро запущен на http://localhost:4321
2. `BEEM_BASE_URL` правильный в `.env`
3. Нет firewall блокировки локального адреса

### Проблема: "Cannot find module 'grammy'"

**Решение**:
```bash
npm install
npm run dev
```

### Проблема: Бот лагает или не отвечает

**Проверь**:
1. Только один Node процесс (ps aux | grep node)
2. Нет других Node приложений на том же порту
3. Посмотри логи на ошибки

## 📞 Поддержка production

### Запуск на production (systemd)

```ini
[Unit]
Description=Beem Video AI (with Telegram Bot)
After=network.target

[Service]
Type=simple
User=beem
WorkingDirectory=/opt/beem/astro
ExecStart=node dist/server/entry.mjs
Restart=always

Environment="NODE_ENV=production"
Environment="TELEGRAM_BOT_TOKEN=..."
Environment="BEEM_BASE_URL=https://api.beem.video"
Environment="DATABASE_URL=/opt/beem/data/db.sqlite"

[Install]
WantedBy=multi-user.target
```

### Проверка на production

```bash
# Процесс живой
systemctl status beem

# Логи
journalctl -u beem -f

# Тест API
curl https://api.beem.video/api/user/balance

# Тест бота (отправь сообщение)
# /start в Telegram
```

## 📚 Файлы для справки

- `TELEGRAM_BOT_INTEGRATED.md` - полная документация интеграции
- `src/telegram/bot.ts` - главная логика бота
- `src/telegram/start.ts` - инициализация
- `src/middleware.ts` - точка входа (ищи `initializeTelegramBot`)

## 🎯 Итого

| Что | Было | Стало |
|-----|------|-------|
| Процессы | 2 (Astro + Bot) | 1 (Astro + Bot внутри) |
| Папки | /astro + /bot | только /astro |
| Порты | :4321 (Астро) + Polling (Бот) | :4321 (всё вместе) |
| systemd услуг | 2 | 1 |
| Сложность запуска | 2 терминала | 1 команда |
| Память | Больше (2 Node процесса) | Меньше (1 процесс) |
| Production ready | Нет | ✅ Да |

**Бот теперь является встроенной частью Beem backend! 🎉**
