# 🚀 Telegram-бот в Astro 5 (RUNTIME-LOADER АРХИТЕКТУРА)

## ✅ Финальное решение

Использование **runtime-loader** с динамическим `import()` вместо static `import`.

Это гарантирует что grammy:
- ✅ НЕ попадает в Vite client bundle
- ✅ Загружается только в Node runtime через `dist/server/chunks/runtime_*.mjs`
- ✅ Бот инициализируется при старте middleware (гарантированная точка)

## 🏗️ Архитектура

```
npm run build && npm run preview
   ↓
Astro запускается в Node
   ├─ src/middleware.ts загружается (ГАРАНТИРОВАННО)
   │  └─ if (process.env.TELEGRAM_BOT_TOKEN)
   │     └─ dynamic import('./telegram/runtime') выполняется
   │        └─ dist/server/chunks/runtime_*.mjs загружается в runtime
   │           ├─ console.log('[MIDDLEWARE] 🤖 Loading Telegram Bot runtime...')
   │           └─ import('./telegram/runtime') → initializeTelegramBot()
   │              ├─ Создание Bot instance
   │              ├─ Запуск polling
   │              └─ Бот готов в Telegram
   │
   ├─ Middleware функция обрабатывает HTTP запросы
   │
   └─ HTTP server слушает на localhost:4321
```

## 📝 Ключевые файлы

### 1. ✅ `src/middleware.ts`

```typescript
/**
 * Инициализация Telegram Bot Runtime
 * Используем динамический import для загрузки runtime-loader.
 */
if (typeof globalThis !== 'undefined' && process.env.TELEGRAM_BOT_TOKEN) {
  console.log('[MIDDLEWARE] 🤖 Loading Telegram Bot runtime...');
  import('./telegram/runtime').catch(err => {
    console.error(`[MIDDLEWARE] ⚠️ Failed to load Telegram runtime: ${err.message}`);
  });
}

import { defineMiddleware } from 'astro:middleware';
// ... остальное
```

**Важно**:
- Этот код ВНЕ `defineMiddleware`
- Выполняется при загрузке модуля middleware.ts
- Динамический `import()` - не static import!

### 2. ✅ `src/telegram/runtime.ts` (NEW)

```typescript
/**
 * Telegram Bot Runtime Loader
 * Этот модуль загружается ТОЛЬКО в Node runtime через динамический import.
 * НЕ попадает в Vite bundle, выполняется только при старте сервера.
 */

console.log('[TELEGRAM-RUNTIME] Module loaded, initializing bot...');

import { initializeTelegramBot } from './start';

initializeTelegramBot().catch(err => {
  console.error(`[TELEGRAM-RUNTIME] Failed to initialize bot: ${err.message}`);
});

console.log('[TELEGRAM-RUNTIME] ✅ Module initialization complete');
```

### 3. ✅ `src/telegram/start.ts`

Не изменяется. Содержит `initializeTelegramBot()` и автозапуск при импорте.

### 4. ✅ `astro.config.mjs`

```javascript
export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'standalone'
    // БЕЗ serverEntrypoint (не работает в Astro 5)
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
});
```

## ✅ Проверка что grammy НЕ в client bundle

```bash
# После npm run build:
grep -r "grammy" dist/client
# Результат: (пусто - grammy НЕ в client bundle) ✓

# Но grammy ВСЕ ЕЩЁ в server chunks:
grep -r "grammy" dist/server/chunks/runtime_*.mjs
# Результат: import { Bot, InlineKeyboard, InputFile } from 'grammy'; ✓
```

## 🚀 Жизненный цикл

### При `npm run dev`:

1. Astro dev server запускается
2. src/middleware.ts загружается
3. `if (process.env.TELEGRAM_BOT_TOKEN) { import('./telegram/runtime') }`
4. runtime.ts загружается в runtime (НЕ в браузер!)
5. `initializeTelegramBot()` запускается
6. Telegram-бот создаётся и начинает polling
7. HTTP сервер слушает на localhost:3000

### При `npm run build && npm run preview`:

1. Astro собирает проект в dist/
2. Vite компилирует src/telegram/runtime.ts → dist/server/chunks/runtime_*.mjs
3. grammy остаётся в runtime_*.mjs chunk (НЕ в главный bundle)
4. Middleware компилируется с динамическим import('./chunks/runtime_*.mjs')
5. npm run preview запускает dist/server/entry.mjs
6. Node загружает middleware
7. middleware вызывает dynamic import('./chunks/runtime_*.mjs')
8. runtime_*.mjs загружается в runtime
9. Telegram-бот инициализируется
10. HTTP сервер слушает на localhost:4321

## 🔐 Защита от двойного запуска

```typescript
// В src/telegram/start.ts
if ((globalThis as any).__telegramBotStarted) {
  console.log('Bot already started');
  return;
}
(globalThis as any).__telegramBotStarted = true;
```

Работает даже при hot-reload в dev режиме.

## 💡 Почему это работает

✅ **middleware загружается гарантированно** при старте Astro в режиме standalone
✅ **dynamic import** не включает grammy в браузер-bundle
✅ **dynamic import** загружает grammy только в Node runtime
✅ **globalThis флаг** защитит от дубликатов
✅ **Один процесс** для сайта + API + бота
✅ **Работает в dev и production** без изменений

## ❌ Почему НЕ работают другие подходы

### ❌ static import в middleware

```typescript
// НЕПРАВИЛЬНО!
import './telegram/start'; // Попадает в bundle!

import { defineMiddleware } from 'astro:middleware';
```

Это можно использовать, но grammy может попасть в Vite bundle.

### ❌ serverEntrypoint в Astro 5

```javascript
// НЕПРАВИЛЬНО!
adapter: node({
  mode: 'standalone',
  serverEntrypoint: 'src/server.ts' // Не работает в Astro 5!
}),
```

В Astro 5 Node adapter standalone режим полностью игнорирует `serverEntrypoint`.

### ❌ API маршрут для инициализации

```typescript
// НЕПРАВИЛЬНО!
export async function GET() {
  // Бот запустится только при первом HTTP запросе!
  await initializeTelegramBot();
}
```

Бот не запустится до первого запроса к API.

## ✨ Итог

```
Один Astro процесс = Сайт + API + Telegram-бот
grammy = Node runtime только (НЕ в браузере)
Готово к production (systemd/nginx/Docker)
```

## 📊 Сравнение подходов

| Подход | client bundle | runtime | dev | preview | Рекомендуется |
|--------|---|---|---|---|---|
| **runtime-loader (текущий)** ✅ | ❌ | ✅ | ✅ | ✅ | **ДА** |
| static import в middleware | ⚠️ maybe | ✅ | ✅ | ✅ | Нет |
| serverEntrypoint | ❌ | ❌ | ❌ | ❌ | Нет (не работает) |
| API маршрут | ❌ | ⚠️ | ✅ | ⚠️ | Нет (лениво) |

## 🛠️ Отладка

Если бот не стартует:

```bash
# 1. Проверить что TELEGRAM_BOT_TOKEN установлен
echo $TELEGRAM_BOT_TOKEN

# 2. Проверить логи при build
npm run build 2>&1 | grep -i telegram

# 3. Проверить логи при preview
npm run preview 2>&1 | head -30

# 4. Проверить что runtime_*.mjs существует
ls -la dist/server/chunks/runtime_*.mjs

# 5. Проверить что grammy НЕ в client bundle
grep -r "grammy" dist/client
```
