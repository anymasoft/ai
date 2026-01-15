/**
 * Astro Server Entrypoint
 * Точка входа для Node runtime
 *
 * Загружается при npm run dev / npm run preview
 * Здесь инициализируются фоновые сервисы
 */

// Инициализируем Telegram-бота при старте Node процесса
import './telegram/start';

console.log('🚀 Astro server entry loaded, Telegram bot initialized');
