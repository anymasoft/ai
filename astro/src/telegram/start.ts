/**
 * Lazy-singleton инициализация Telegram-бота
 * Запускается один раз при первом обращении к этому модулю
 * Использует globalThis флаг чтобы избежать повторного запуска
 */

console.log('🚀 TELEGRAM BOT MODULE LOADED');

import { createAndStartBot, startBot } from './bot';

/**
 * Инициализировать и запустить Telegram-бота один раз
 */
export async function initializeTelegramBot(): Promise<void> {
  // Проверяем глобальный флаг чтобы не запускать бота дважды
  // (важно для hot-reload в dev режиме)
  if ((globalThis as any).__telegramBotStarted) {
    console.log('[TELEGRAM-INIT] Bot already started, skipping initialization');
    return;
  }

  // Отмечаем что бот уже инициализирован
  (globalThis as any).__telegramBotStarted = true;

  try {
    console.log('[TELEGRAM-INIT] Initializing Telegram bot...');

    // Создаём бота
    const bot = await createAndStartBot();

    if (!bot) {
      console.warn('[TELEGRAM-INIT] Telegram bot token not set, skipping bot start');
      return;
    }

    // Запускаем бота
    await startBot(bot);

    console.log('[TELEGRAM-INIT] ✅ Telegram bot initialization complete');
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[TELEGRAM-INIT] Failed to initialize bot: ${msg}`);
    // Сбрасываем флаг чтобы можно было переиспользовать при перезагрузке
    (globalThis as any).__telegramBotStarted = false;
  }
}

// Инициализируем бота при импорте этого модуля
// (это важно для src/server.ts)
if (typeof globalThis !== 'undefined') {
  initializeTelegramBot().catch((err) => {
    console.error('[TELEGRAM-INIT] Failed to initialize bot on module load:', err);
  });
}
