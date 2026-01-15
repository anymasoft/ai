# 🚀 Telegram-бот в Astro 5 (ПРАВИЛЬНАЯ АРХИТЕКТУРА)

## ✅ Ключевое открытие

**В Astro 5 `serverEntrypoint` НЕ работает в standalone режиме Node adapter.**

Единственная гарантированная точка старта backend-кода:
- Загрузка `src/middleware.ts`
- Загрузка любого `src/pages/api/*.ts`

Поэтому **Telegram-бот стартует через side-effect import в middleware**.

## 🏗️ Правильная архитектура

```
npm run build && npm run preview
   ↓
Astro запускается в Node
   ├─ src/middleware.ts загружается (всегда, при старте)
   │  ├─ import './telegram/start' (SIDE-EFFECT)
   │  └─ src/telegram/start.ts выполняется
   │     ├─ console.log('🚀 TELEGRAM BOT MODULE LOADED')
   │     └─ initializeTelegramBot() (if не запущен)
   │        ├─ Проверка globalThis.__telegramBotStarted
   │        ├─ Создание Bot instance
   │        └─ bot.start() (polling)
   │
   ├─ Middleware функция defineMiddleware (обработка HTTP)
   │
   └─ HTTP server слушает
```

## 📝 Что было сделано

### 1. ✅ `src/middleware.ts`

Добавлен side-effect import в самый верх:

```typescript
// 🤖 Инициализируем Telegram-бота при загрузке middleware
import './telegram/start';

import { defineMiddleware } from 'astro:middleware';
// ... остальное
```

**Важно**:
- Этот импорт ВНЕ `defineMiddleware`
- Не условный
- Выполняется ровно один раз при загрузке модуля

### 2. ✅ `src/telegram/start.ts`

Имеет правильный автозапуск при импорте:

```typescript
console.log('🚀 TELEGRAM BOT MODULE LOADED');

export async function initializeTelegramBot(): Promise<void> {
  // Проверка globalThis флага
  if ((globalThis as any).__telegramBotStarted) {
    return;
  }
  (globalThis as any).__telegramBotStarted = true;

  // Создание и запуск бота
}

// Запуск при импорте
if (typeof globalThis !== 'undefined') {
  initializeTelegramBot().catch(err => {
    console.error('[TELEGRAM-INIT] Failed:', err);
  });
}
```

### 3. ✅ `astro.config.mjs`

Удалён `serverEntrypoint` (не работает в standalone):

```javascript
adapter: node({
  mode: 'standalone'
  // НЕ использовать serverEntrypoint в Astro 5!
}),

vite: {
  ssr: {
    external: ['grammy', 'axios']
  },
  build: {
    rollupOptions: {
      external: ['grammy', 'axios']
    }
  }
}
```

### 4. ❌ `src/server.ts`

Удалён (неправильный подход для Astro 5)

## 🚀 Запуск

```bash
npm run build
npm run preview
```

## ✅ Ожидаемый вывод

```
🚀 TELEGRAM BOT MODULE LOADED
[TELEGRAM-INIT] Initializing Telegram bot...
[TELEGRAM-BOT] Bot instance created
[TELEGRAM-BOT] ✅ Bot logged in as @your_bot_name
[TELEGRAM-BOT] ✅ Telegram bot is running!

▶ src/pages
▶ Receiving requests at http://localhost:3000/
```

Если этого нет → middleware не загрузился.

## 🔐 Защита от двойного старта

```typescript
if ((globalThis as any).__telegramBotStarted) {
  console.log('Bot already started');
  return;
}
(globalThis as any).__telegramBotStarted = true;
```

Работает даже при hot-reload в dev режиме.

## 📊 Жизненный цикл

### При npm run dev

1. Astro запускается
2. middleware.ts загружается
3. import './telegram/start' выполняется
4. console.log('🚀 TELEGRAM BOT MODULE LOADED')
5. initializeTelegramBot() запускается
6. Бот готов в Telegram

### При npm run build + npm run preview

1. Astro собирает проект
2. dist/server собирается (включая middleware)
3. Node запускает dist/server/entry.mjs
4. middleware загружается при старте
5. Бот инициализируется ровно один раз
6. Один Node процесс работает

## 💡 Почему это работает

- ✅ middleware загружается Astro при старте Node сервера
- ✅ side-effect import выполняется сразу
- ✅ globalThis флаг защитит от дубликатов
- ✅ Не зависит от HTTP запросов
- ✅ Работает в dev и production
- ✅ Один процесс

## ❌ Почему serverEntrypoint не работает

В Astro 5 Node adapter standalone режимеполностью убирает эту возможность.Адаптер использует собственный entry point,который загружает Astro runtime, а потом middleware.Собственный server.ts игнорируется.

## ✨ Итог

**Один Astro процесс = Сайт + API + Telegram-бот**

Готово к production. Можно деплоить на VPS под nginx.
