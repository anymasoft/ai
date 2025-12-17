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
 * expiresAt ОБЯЗАТЕЛЬНО передается явно от вызывающей стороны
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

    const now = Date.now();

    // Обновляем план пользователя
    await db.execute(
      `UPDATE users SET plan = ?, expiresAt = ?, paymentProvider = ?, updatedAt = ? WHERE id = ?`,
      [plan, expiresAt, paymentProvider, now, userId]
    );

    console.log(
      `[updateUserPlan] Success - user ${userId} updated to plan ${plan}, expires at ${expiresAt}`
    );
  } catch (error) {
    console.error(`[updateUserPlan] Error updating user plan:`, error);
    throw error;
  }
}

/**
 * Получает информацию о пользователе из БД для проверки подписки
 * ВКЛЮЧАЕТ две проверки downgrade:
 * 1) если expiresAt < now → план истёк по времени
 * 2) если used >= limit → лимит сценариев исчерпан
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
    const now = Date.now();
    let plan = user.plan || "free";
    let expiresAt = user.expiresAt || null;

    // Защита от старых значений в БД: если expiresAt в секундах (< 10^12), конвертируем
    if (expiresAt && expiresAt < 1_000_000_000_000) {
      console.log(
        `[Payments] Converting expiresAt from seconds to milliseconds for user ${userId}: ${expiresAt} -> ${expiresAt * 1000}`
      );
      expiresAt = expiresAt * 1000;
    }

    // Проверка 1: АВТОМАТИЧЕСКИЙ DOWNGRADE по времени (если подписка истекла)
    const expiredByTime = expiresAt && expiresAt < now;

    // Проверка 2: АВТОМАТИЧЕСКИЙ DOWNGRADE по лимиту (если сценарии исчерпаны)
    let expiredByUsage = false;
    if (plan !== "free") {
      try {
        const { getMonthlyScriptLimit } = await import("@/config/plan-limits");
        const { getMonthlyScriptsUsed } = await import("@/lib/script-usage");

        const monthlyLimit = getMonthlyScriptLimit(plan as any);
        const monthlyUsed = await getMonthlyScriptsUsed(userId);

        if (monthlyLimit > 0 && monthlyUsed >= monthlyLimit) {
          console.log(
            `[Payments] User ${userId} exhausted monthly limit: ${monthlyUsed}/${monthlyLimit}`
          );
          expiredByUsage = true;
        }
      } catch (usageError) {
        console.error(`[Payments] Error checking usage limit:`, usageError);
        // Если ошибка при проверке лимита, не даунгрейдим
      }
    }

    // Если тариф истёк ПО ВРЕМЕНИ ИЛИ ПО ЛИМИТУ → downgrade на free
    if ((expiredByTime || expiredByUsage) && plan !== "free") {
      const reason = expiredByTime ? "subscription expired" : "usage limit exhausted";
      console.log(
        `[Payments] Auto-downgrading user ${userId} from ${plan} to free (${reason}). expiresAt: ${expiresAt}, now: ${now}`
      );
      plan = "free";
      expiresAt = null;
    }

    return {
      plan,
      expiresAt,
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
  const now = Date.now();
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
