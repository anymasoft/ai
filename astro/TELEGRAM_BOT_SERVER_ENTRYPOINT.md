# 🚀 Telegram-бот стартует при старте Node сервера

## ✅ Архитектура

Telegram-бот теперь запускается при старте Node процесса, а не при HTTP-запросе.

```
npm run preview
   ↓
Node process стартует
   ├─ src/server.ts загружается (server entrypoint)
   │  └─ import './telegram/start' → бот инициализируется
   │
   ├─ Astro HTTP server запускается (localhost:3000)
   │  └─ middleware просто обрабатывает запросы (БЕЗ запуска бота)
   │
   └─ Telegram-бот работает в фоне (grammY polling)
```

## 📝 Что было изменено

### 1. Создан `src/server.ts`

Новая точка входа для Node runtime:

```typescript
// Инициализируем Telegram-бота при старте Node процесса
import './telegram/start';

console.log('🚀 Astro server entry loaded, Telegram bot initialized');
```

Этот файл загружается ОДИН РАЗ при старте сервера.

### 2. Обновлён `astro.config.mjs`

Добавлен `serverEntrypoint`:

```javascript
adapter: node({
  mode: 'standalone',
  serverEntrypoint: 'src/server.ts'  ← НОВОЕ
}),
```

Теперь Astro использует `src/server.ts` как точку входа при старте.

### 3. Очищен `src/middleware.ts`

Удалены:
- ❌ импорт `initializeTelegramBot`
- ❌ флаг `botInitialized`
- ❌ код инициализации бота в middleware

Middleware теперь только обрабатывает HTTP запросы, не запускает фоновые сервисы.

### 4. Обновлён `src/telegram/start.ts`

Добавлен автоматический запуск при импорте:

```typescript
// Инициализируем бота при импорте этого модуля
if (typeof globalThis !== 'undefined') {
  initializeTelegramBot().catch((err) => {
    console.error('[TELEGRAM-INIT] Failed to initialize bot on module load:', err);
  });
}
```

Благодаря этому, когда `server.ts` делает `import './telegram/start'`, бот сразу инициализируется.

## 🏗️ Поток выполнения

### При `npm run dev`:

```
1. Astro dev server запускается
2. src/server.ts загружается (через serverEntrypoint)
3. import './telegram/start' → initializeTelegramBot()
4. Telegram-бот создаётся и начинает polling
5. HTTP сервер слушает на localhost:3000
6. Middleware обрабатывает запросы
```

### При `npm run build && npm run preview`:

```
1. Astro собирает проект в dist/
2. Babel компилирует src/server.ts в dist/server/
3. npm run preview запускает dist/server/entry.mjs
4. src/server.ts загружается при старте
5. Telegram-бот инициализируется в Node процессе
6. HTTP сервер слушает на localhost:3000
7. Всё в одном процессе
```

## ✅ Ожидаемый вывод

При `npm run dev` или `npm run preview`:

```
🚀 Astro server entry loaded, Telegram bot initialized
[TELEGRAM-INIT] Initializing Telegram bot...
[TELEGRAM-BOT] Temp directory created: /path/to/tmp/telegram-bot
[TELEGRAM-BOT] Bot instance created
[TELEGRAM-BOT] Starting bot...
[TELEGRAM-BOT] ✅ Backend is available
[TELEGRAM-BOT] ✅ Bot logged in as @your_bot_name
[TELEGRAM-BOT] ✅ Telegram bot is running!
```

И немного ниже:

```
▶ src/pages
▶ Receiving requests at http://localhost:3000/
```

## 📊 Сравнение

### Раньше (неправильно):

```
HTTP запрос → middleware → initializeTelegramBot()
Проблема: бот не запускался до первого HTTP запроса
          в dev режиме требовалось открыть браузер
```

### Теперь (правильно):

```
Node старт → src/server.ts → import './telegram/start' → initializeTelegramBot()
Преимущество: бот запускается сразу при старте сервера
              не зависит от HTTP запросов
```

## 🔐 Защита от дубликатов

Остаётся двухуровневая защита:

1. **globalThis флаг** (в `start.ts`):
   ```typescript
   if ((globalThis as any).__telegramBotStarted) {
     return;
   }
   (globalThis as any).__telegramBotStarted = true;
   ```

2. **initializeTelegramBot()** - просто функция, может быть вызвана много раз, но глобальный флаг защитит от дублирования.

## 🚀 Запуск

```bash
# Development
npm run dev

# Production
npm run build
npm run preview
```

## ✨ Итого

✅ Telegram-бот запускается при старте Node процесса
✅ Один процесс для сайта + API + бота
✅ Middleware не загромождён фоновыми сервисами
✅ Server entrypoint правильно организован
✅ Готово к production (systemd)

## 📁 Измененные файлы

- ✅ `src/server.ts` - НОВЫЙ (точка входа)
- ✅ `astro.config.mjs` - ОБНОВЛЁН (serverEntrypoint)
- ✅ `src/middleware.ts` - ОЧИЩЕН (убран код инициализации)
- ✅ `src/telegram/start.ts` - ОБНОВЛЁН (автозапуск при импорте)
