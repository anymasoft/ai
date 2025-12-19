/**
 * Логика явного downgrade тариф пользователя
 *
 * ПРАВИЛО: Downgrade МОЖЕТ происходить ТОЛЬКО в явных действиях:
 * - Webhook от платёжной системы (успешная оплата)
 * - Ручные админ-операции
 * - Автоматические job'ы (если будут созданы)
 *
 * ЗАПРЕЩЕНО: Downgrade при ЧТЕНИИ данных (SELECT)
 * - Функции чтения НИКОГДА не должны мутировать план
 * - план в БД — это единственный источник истины
 * - если план устарел по времени или лимитам — это не повод менять его при чтении
 *
 * Downgrade логика по причинам:
 * 1. WEBHOOK (payment.succeeded) - активирует новый тариф на 30 дней
 * 2. EXPIRATION (time-based) - когда expiresAt < now (текущее время)
 *    - Текущая реализация: job'а нет, expiration проверяется при явном downgrade
 * 3. LIMIT_EXHAUSTED (usage-based) - когда месячное использование >= лимит
 *    - Текущая реализация: downgrade происходит только явно, не автоматически
 */

import { db } from "./db";

interface DowngradeContext {
  userId: string;
  reason: "expired" | "limit_exhausted" | "admin" | "webhook";
  details?: string;
}

/**
 * ЯВНЫЙ downgrade пользователя в plan='free'
 *
 * Используется ТОЛЬКО в следующих случаях:
 * 1. Webhook от YooKassa при платеже (но там используется updateUserPlan)
 * 2. Администратор явно понижает тариф
 * 3. Job по истечению срока подписки (если будет создан)
 *
 * НИКОГДА не вызывается при чтении данных
 */
export async function downgradeUserToFree(
  context: DowngradeContext
): Promise<void> {
  try {
    console.log(
      `[SubscriptionDowngrade] Downgrading user ${context.userId} to free: ${context.reason}`,
      context.details ? `Details: ${context.details}` : ""
    );

    const now = Math.floor(Date.now() / 1000);

    // Обновляем план в БД
    await db.execute(
      `UPDATE users SET plan = 'free', expiresAt = NULL, updatedAt = ? WHERE id = ?`,
      [now, context.userId]
    );

    console.log(`[SubscriptionDowngrade] Successfully downgraded user ${context.userId}`);
  } catch (error) {
    console.error(
      `[SubscriptionDowngrade] Error downgrading user ${context.userId}:`,
      error
    );
    throw error;
  }
}

/**
 * Проверяет, нужен ли downgrade, но НЕ выполняет его
 *
 * Используется ТОЛЬКО для:
 * - Информационных целей (логирование, отладка)
 * - Явных admin операций (когда админ проверяет статус)
 * - Job'ов (если будут созданы в будущем)
 *
 * НИКОГДА не вызывается автоматически при пользовательских запросах
 */
export async function shouldDowngradeUser(userId: string): Promise<{
  shouldDowngrade: boolean;
  reason?: "expired" | "limit_exhausted";
}> {
  try {
    const result = await db.execute(
      `SELECT plan, expiresAt FROM users WHERE id = ?`,
      [userId]
    );

    const rows = Array.isArray(result) ? result : result.rows || [];
    if (rows.length === 0) {
      return { shouldDowngrade: false };
    }

    const user = rows[0];

    // Проверяем только для платных тарифов
    if (user.plan === "free") {
      return { shouldDowngrade: false };
    }

    // Проверка 1: Истёк ли срок подписки?
    if (user.expiresAt) {
      const now = Math.floor(Date.now() / 1000);
      if (user.expiresAt < now) {
        return {
          shouldDowngrade: true,
          reason: "expired",
        };
      }
    }

    // Примечание: Проверка лимитов здесь не реализована
    // Если в будущем понадобится auto-downgrade при превышении лимитов,
    // эта функция может быть расширена

    return { shouldDowngrade: false };
  } catch (error) {
    console.error(`[SubscriptionDowngrade] Error checking user ${userId}:`, error);
    return { shouldDowngrade: false };
  }
}

/**
 * Явный downgrade при истечении срока подписки
 *
 * Используется в явных операциях (админ или job), НЕ при чтении
 */
export async function downgradeExpiredSubscriptions(): Promise<{
  count: number;
  userIds: string[];
}> {
  try {
    console.log("[SubscriptionDowngrade] Starting expired subscription check");

    const now = Math.floor(Date.now() / 1000);

    // Ищем всех пользователей с истёкшей подпиской
    const result = await db.execute(
      `SELECT id, email FROM users WHERE plan != 'free' AND expiresAt > 0 AND expiresAt < ?`,
      [now]
    );

    const rows = Array.isArray(result) ? result : result.rows || [];
    const expiredUsers = rows.map((row: any) => row.id);

    if (expiredUsers.length === 0) {
      console.log("[SubscriptionDowngrade] No expired subscriptions found");
      return { count: 0, userIds: [] };
    }

    console.log(
      `[SubscriptionDowngrade] Found ${expiredUsers.length} expired subscriptions`
    );

    // Downgrade каждого пользователя
    for (const userId of expiredUsers) {
      await downgradeUserToFree({
        userId,
        reason: "expired",
        details: `Subscription expired at ${new Date(now * 1000).toISOString()}`,
      });
    }

    console.log(
      `[SubscriptionDowngrade] Successfully downgraded ${expiredUsers.length} users`
    );

    return {
      count: expiredUsers.length,
      userIds: expiredUsers,
    };
  } catch (error) {
    console.error("[SubscriptionDowngrade] Error during downgrade check:", error);
    throw error;
  }
}
