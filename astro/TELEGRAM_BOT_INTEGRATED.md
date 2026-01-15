# 🤖 Telegram-бот встроен в Astro Runtime

Telegram-бот теперь работает в одном Node.js процессе вместе с сайтом и API.

## 🎯 Что изменилось

### Архитектура

**Раньше** (2 процесса):
```
Process 1: npm run dev (Astro)     → localhost:4321
Process 2: npm run dev (Bot)       → grammY polling
```

**Теперь** (1 процесс):
```
npm run dev (или npm run preview)
    ├─ Astro HTTP server (pages + API)     → localhost:4321
    └─ Telegram Bot (grammY polling)       → автоматический запуск
```

### Как запускается бот

1. **При `npm run dev` или `npm run preview`**:
   - Astro стартует
   - При первом HTTP запросе запускается middleware
   - Middleware инициализирует Telegram-бота один раз (lazy-singleton)
   - Бот начинает polling Telegram API

2. **Hot-reload в dev**:
   - Используется глобальный флаг `globalThis.__telegramBotStarted`
   - Бот запускается только один раз при перезагрузке

## 📂 Структура файлов

### Новое расположение кода бота

**Перемещено из `/bot/src/*` в `/src/telegram/*`**:

```
/src/telegram/
├── bot.ts          # Главный код бота (обработчики, логика)
├── state.ts        # In-memory управление состоянием пользователей
├── api.ts          # HTTP клиент для backend
└── start.ts        # Lazy-singleton инициализация
```

### Удалено

- ❌ `/bot/` - полностью удалена папка
- ❌ `/bot/package.json`, `/bot/tsconfig.json`, `/bot/.env.example`

### Обновлено

- ✅ `/astro/package.json` - добавлены `grammy@^1.24.1` и `axios@^1.6.5`
- ✅ `/astro/src/middleware.ts` - добавлена инициализация бота
- ✅ Все импорты обновлены для работы в контексте Astro

## 🚀 Запуск

### Development режим

```bash
cd /astro
npm install  # Установить новые зависимости grammy и axios
npm run dev
```

Вывод:
```
  ▶ src/pages
  ▶ Receiving requests at http://localhost:4321/
[TELEGRAM-INIT] Initializing Telegram bot...
[TELEGRAM-BOT] Temp directory created: /tmp/telegram-bot
[TELEGRAM-BOT] Bot instance created
[TELEGRAM-BOT] Starting bot...
[TELEGRAM-BOT] Backend URL: http://localhost:4321
[TELEGRAM-BOT] ✅ Backend is available
[TELEGRAM-BOT] ✅ Bot logged in as @your_bot_name
[TELEGRAM-BOT] ✅ Telegram bot is running!
```

### Preview режим (production-like)

```bash
cd /astro
npm run build
npm run preview
```

Бот также автоматически запустится.

### Production (systemd)

```bash
npm install
npm run build
npm run preview  # или node ./dist/server/entry.mjs
```

## 🔑 Переменные окружения

Остаются теми же. В `/astro/.env` или `/astro/.env.local`:

```env
TELEGRAM_BOT_TOKEN=123456789:ABCdefGhIjKlmnoPqrStUvwXYZ
BEEM_BASE_URL=http://localhost:4321  # если локально
```

**ВАЖНО**: Бот не запустится без `TELEGRAM_BOT_TOKEN`. Если переменная не установлена, бот пропустит инициализацию с warning.

## 🔄 Жизненный цикл

### При `npm run dev`

1. Астро запускается на localhost:4321
2. При первом HTTP запросе (любом, например GET /)
3. middleware.ts проверяет флаг `botInitialized`
4. Вызывает `initializeTelegramBot()` один раз
5. `/telegram/start.ts` проверяет глобальный флаг `globalThis.__telegramBotStarted`
6. Создаёт Bot instance через `createAndStartBot()`
7. Запускает polling через `startBot()`
8. Бот готов принимать сообщения

### При hot-reload (изменение файла)

- Middleware флаг `botInitialized` сбрасывается ❌ (будет пересоздан)
- Глобальный флаг `globalThis.__telegramBotStarted` остаётся ✅ (не будет дважды)
- Бот НЕ пересоздаётся

**Результат**: Один бот работает на весь процесс, не дублируется.

### При `npm run preview` или production

- Нет hot-reload
- Бот стартует один раз при первом запросе
- Работает всё время пока процесс живо

## 📊 Логирование

### Инициализация

```
[TELEGRAM-INIT] Initializing Telegram bot...
[TELEGRAM-BOT] Temp directory created: /path/to/tmp/telegram-bot
[TELEGRAM-BOT] Bot instance created
[TELEGRAM-BOT] Starting bot...
[TELEGRAM-INIT] ✅ Telegram bot initialization complete
```

### События

Те же логи как раньше:
```
[TELEGRAM-BOT] [BOT_START] user=123456789
[TELEGRAM-BOT] [BOT_PHOTO_RECEIVED] user=123456789
[TELEGRAM-API] Generation started: tg_gen_...
```

### Ошибки

```
[TELEGRAM-INIT] Failed to initialize bot: TELEGRAM_BOT_TOKEN not set
[MIDDLEWARE] Failed to initialize telegram bot: ...
```

## ✅ Проверка что бот запущен

### В логах

```bash
# Посмотри вывод при npm run dev
# Если видишь эти строки, бот запущен:
# [TELEGRAM-BOT] ✅ Bot logged in as @your_bot_name
# [TELEGRAM-BOT] ✅ Telegram bot is running!
```

### Через Telegram

1. Открой своего бота
2. Отправь `/start`
3. Если получил ответ, бот работает ✅

### Проверка процесса

```bash
# Убедись что только один Node процесс запущен:
ps aux | grep node
# Должно быть только:
# node dist/server/entry.mjs
# (или npm run preview)
```

## 🐛 Решение проблем

### Проблема: "TELEGRAM_BOT_TOKEN not set"

**Решение**:
1. Проверь что переменная в `.env.local` или `.env`
2. Убедись что имя переменной точное: `TELEGRAM_BOT_TOKEN`
3. Перезагрузи процесс: Ctrl+C и `npm run dev` заново

### Проблема: Бот не отвечает в Telegram

**Решение**:
1. Проверь логи на ошибки
2. Убедись что backend доступен: `curl http://localhost:4321/`
3. Проверь что только один процесс Node запущен

### Проблема: "Backend may not be available"

**Решение**:
1. Убедись что Астро запустился успешно
2. Проверь что порт 4321 открыт
3. Проверь `BEEM_BASE_URL` если используешь нестандартный адрес

### Проблема: Hot-reload создаёт дублирующихся ботов

**Решение**: Не должно быть! Используется глобальный флаг. Если всё-таки есть, проверь:
1. Нет ли других процессов Node
2. Убедись что используется правильная версия кода

## 📈 Развёртывание на production

### systemd служба

```ini
[Unit]
Description=Beem Video AI Service
After=network.target

[Service]
Type=simple
User=beem
WorkingDirectory=/opt/beem/ai/astro
ExecStart=node dist/server/entry.mjs
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal

Environment="NODE_ENV=production"
Environment="TELEGRAM_BOT_TOKEN=..."
Environment="BEEM_BASE_URL=https://api.beem.video"
Environment="DATABASE_URL=/opt/beem/data/db.sqlite"
Environment="MINIMAX_API_KEY=..."

[Install]
WantedBy=multi-user.target
```

### Развёртывание

```bash
# Build
npm run build

# Копируем на production
rsync -av dist/ /opt/beem/ai/astro/dist/

# Запускаем
sudo systemctl start beem
sudo systemctl status beem

# Логи
sudo journalctl -u beem -f
```

### Мониторинг

```bash
# Проверить что процесс живой
ps aux | grep "node dist/server/entry.mjs"

# Проверить что API работает
curl https://api.beem.video/api/user/balance

# Проверить что бот работает
# Отправь сообщение боту в Telegram
```

## 🎯 Ключевые точки кода

### 1. Инициализация (middleware.ts)

```typescript
import { initializeTelegramBot } from './telegram/start';

let botInitialized = false;

export const onRequest = defineMiddleware((context, next) => {
  if (!botInitialized) {
    botInitialized = true;
    initializeTelegramBot().catch(...);
  }
  return next();
});
```

### 2. Lazy-singleton (telegram/start.ts)

```typescript
if ((globalThis as any).__telegramBotStarted) {
  return; // Уже запущен
}
(globalThis as any).__telegramBotStarted = true;
```

### 3. Главная логика (telegram/bot.ts)

```typescript
export async function createAndStartBot(): Promise<Bot | null> {
  // Создаёт Bot instance с обработчиками
}

export async function startBot(bot: Bot): Promise<void> {
  // Запускает polling
}
```

## 📝 Резюме

✅ Telegram-бот встроен в Astro runtime
✅ Один Node.js процесс для сайта, API и бота
✅ Lazy-singleton инициализация (запускается один раз)
✅ Hot-reload безопасность (не создаёт дубликаты)
✅ Готово к production (systemd)
✅ Все окружающие переменные остались теми же
✅ Ничего не сломано в существующей архитектуре

## 🔗 Связанные файлы

- `/astro/src/telegram/bot.ts` - главная логика бота
- `/astro/src/telegram/start.ts` - инициализация
- `/astro/src/telegram/state.ts` - состояние пользователей
- `/astro/src/telegram/api.ts` - HTTP клиент
- `/astro/src/middleware.ts` - точка входа для инициализации
- `/astro/src/pages/api/telegram/generate.ts` - генерация видео
- `/astro/src/pages/api/telegram/status.ts` - проверка статуса
- `/astro/package.json` - зависимости grammy и axios
