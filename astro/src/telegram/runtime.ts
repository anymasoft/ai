/**
 * Telegram Bot Runtime Loader
 *
 * Этот модуль загружается ТОЛЬКО в Node runtime через динамический import.
 * НЕ попадает в Vite bundle, выполняется только при старте сервера.
 *
 * Загружается из src/server.ts:
 *   if (process.env.TELEGRAM_BOT_TOKEN) {
 *     import('./telegram/runtime')
 *   }
 */

console.log('[TELEGRAM-RUNTIME] Module loaded, initializing bot...');

import { initializeTelegramBot } from './start';

// Инициализируем бота при загрузке этого модуля
initializeTelegramBot().catch(err => {
  const msg = err instanceof Error ? err.message : 'Unknown error';
  console.error(`[TELEGRAM-RUNTIME] Failed to initialize bot: ${msg}`);
});

console.log('[TELEGRAM-RUNTIME] ✅ Module initialization complete');
