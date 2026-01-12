/**
 * Telegram Notifier - система мгновенных уведомлений об ошибках
 * Отправляет критические ошибки в Telegram чат администратора
 */

// In-memory de-duplication cache (ограничение спама)
// Ключ: `${stage}::${errorMessage}`
// Значение: timestamp последнего сообщения
const lastAlertTime = new Map<string, number>();
const ALERT_COOLDOWN_MS = 60000; // 1 минута между одинаковыми ошибками

/**
 * Отправить уведомление об ошибке в Telegram
 *
 * @param stage - этап где произошла ошибка (GPT_ENHANCE, MINIMAX_CALL, etc)
 * @param errorMessage - текст ошибки
 * @param userId - ID пользователя (опционально)
 * @param generationId - ID генерации (опционально)
 */
export async function notifyAdmin(
  stage: string,
  errorMessage: string,
  userId?: string,
  generationId?: string
): Promise<void> {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID || '432400514';

    if (!botToken) {
      console.warn('[TG ALERT] TELEGRAM_BOT_TOKEN not configured, skipping notification');
      return;
    }

    // ДЕ-ДУПЛИКАЦИЯ: Проверяем не было ли такой ошибки недавно
    const cacheKey = `${stage}::${errorMessage}`;
    const lastTime = lastAlertTime.get(cacheKey);
    const now = Date.now();

    if (lastTime && now - lastTime < ALERT_COOLDOWN_MS) {
      console.log(`[TG ALERT] Cooldown active for ${stage}, skipping duplicate alert`);
      return;
    }

    // Обновляем время последнего уведомления
    lastAlertTime.set(cacheKey, now);

    // Формируем HTML сообщение
    const message = `⚠️ <b>Beem Error</b>\n<b>Stage:</b> ${stage}\n<b>User:</b> ${userId || 'N/A'}\n<b>Generation:</b> ${generationId || 'N/A'}\n<b>Error:</b> ${escapeHtml(errorMessage)}`;

    // Отправляем в Telegram
    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[TG ALERT] Failed to send Telegram notification:', errorData);
      return;
    }

    console.error(`[TG ALERT] Stage: ${stage}, User: ${userId || 'N/A'}, Generation: ${generationId || 'N/A'}, Error: ${errorMessage}`);
  } catch (error) {
    console.error('[TG ALERT] Exception in notifyAdmin:', error);
    // Не выбрасываем ошибку - notification система не должна ломать pipeline
  }
}

/**
 * Экранировать HTML специальные символы для Telegram
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Очистить de-duplication cache (для тестирования)
 */
export function clearAlertCache(): void {
  lastAlertTime.clear();
}
