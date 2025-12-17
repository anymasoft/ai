/**
 * Утилиты для работы с платежами через ЮKassa
 */

import { db } from "./db";

interface UpdateUserPlanParams {
  userId: string;
  plan: "basic" | "professional" | "enterprise" | "free";
  expiresAt: number | null;
  paymentProvider?: string;
}

/**
 * Обновляет план пользователя и срок действия подписки в БД
 * После успешной оплаты ЮKassa вызывает эту функцию
 * Также сбрасывает использованные сценарии за текущий месяц
 */
export async function updateUserPlan({
  userId,
  plan,
  expiresAt,
  paymentProvider = "yookassa",
}: UpdateUserPlanParams): Promise<void> {
  try {
    console.log(
      `[updateUserPlan] Starting update for user ${userId}, new plan: ${plan}, provider: ${paymentProvider}`
    );

    const now = Math.floor(Date.now() / 1000);

    // Обновляем план пользователя
    const result = await db.execute(
      `UPDATE users SET plan = ?, expiresAt = ?, paymentProvider = ?, updatedAt = ? WHERE id = ?`,
      [plan, expiresAt, paymentProvider, now, userId]
    );

    console.log(
      `[updateUserPlan] SQL execute completed for user ${userId}`
    );

    // Сбрасываем использованные сценарии за текущий месяц
    // Это необходимо, чтобы пользователь получил чистый лимит при смене тарифа
    try {
      const today = new Date();
      const monthPrefix = today.toISOString().slice(0, 7); // YYYY-MM

      const deleteResult = await db.execute(
        `DELETE FROM user_usage_daily WHERE userId = ? AND day LIKE ?`,
        [userId, monthPrefix + '%']
      );

      console.log(
        `[updateUserPlan] Reset usage for user ${userId} for month ${monthPrefix}`
      );
    } catch (deleteError) {
      console.error(`[updateUserPlan] Error resetting usage:`, deleteError);
      // Не прерываем процесс если сброс usage не сработал
      // План всё равно обновлён
    }

    console.log(
      `[updateUserPlan] success - user ${userId} updated to plan ${plan}, expires at ${expiresAt}`
    );
  } catch (error) {
    console.error(`[updateUserPlan] Error updating user plan:`, error);
    console.error(`[updateUserPlan] Error details:`, JSON.stringify(error));
    throw error;
  }
}

/**
 * Получает информацию о пользователе из БД
 * ЧИТАЕТ ТОЛЬКО, БЕЗ ИЗМЕНЕНИЙ.
 *
 * ПРАВИЛО: users.plan НИКОГДА НЕ МЕНЯЕТСЯ ПРИ ЧТЕНИИ.
 * Downgrade происходит ТОЛЬКО в явном действии (webhook, job), БЕЗ AUTO.
 */
export async function getUserPaymentInfo(userId: string): Promise<{
  plan: string;
  expiresAt: number | null;
  paymentProvider: string;
} | null> {
  try {
    const result = await db.execute(
      `SELECT plan, expiresAt, paymentProvider FROM users WHERE id = ?`,
      [userId]
    );
    const rows = Array.isArray(result) ? result : result.rows || [];
    if (rows.length === 0) return null;

    const user = rows[0];

    // ЧИСТОЕ ЧТЕНИЕ - БЕЗ ЛОГИКИ DOWNGRADE
    return {
      plan: user.plan || "free",
      expiresAt: user.expiresAt || null,
      paymentProvider: user.paymentProvider || "free",
    };
  } catch (error) {
    console.error(`[Payments] Error getting user payment info:`, error);
    return null;
  }
}

/**
 * Проверяет, активна ли подписка пользователя
 */
export function isSubscriptionActive(expiresAt: number | null): boolean {
  if (!expiresAt) return false;
  const now = Math.floor(Date.now() / 1000);
  return expiresAt > now;
}

/**
 * Получает цену платежа для тариф (в копейках для ЮKassa API)
 */
export function getPlanPrice(
  plan: "basic" | "professional" | "enterprise"
): number {
  const prices: Record<string, number> = {
    basic: 99000, // 990 ₽ в копейках
    professional: 249000, // 2490 ₽ в копейках
    enterprise: 599000, // 5990 ₽ в копейках
  };
  return prices[plan] || 0;
}

/**
 * Получает имя тариф на русском
 */
export function getPlanName(
  plan: "basic" | "professional" | "enterprise"
): string {
  const names: Record<string, string> = {
    basic: "Basic",
    professional: "Professional",
    enterprise: "Enterprise",
  };
  return names[plan] || "Unknown";
}
