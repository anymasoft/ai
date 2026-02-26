/**
 * Vite plugin to bypass Host header validation
 * Allows webhooks from ngrok, MiniMax, payment systems, etc.
 *
 * ПРОБЛЕМА: Vite по умолчанию блокирует запросы с неоправданным Host header
 * Это ломает MiniMax callback, платежные webhooks, ngrok туннели
 *
 * РЕШЕНИЕ: Патчим Vite чтобы пропустить проверку Host для всех запросов
 */
export default function skipHostCheck() {
  return {
    name: 'vite-skip-host-check',
    apply: 'serve', // Применяем только в dev режиме
    configResolved(config) {
      // Отключаем Host check на уровне конфига
      config.server = config.server || {};
      config.server.allowedHosts = true; // Разрешаем всех hosts
      config.server.strictPort = false;
      config.server.hmr = false;
    },
  };
}
