/**
 * Утилиты для работы с платежами через ЮKassa
 */

import { db } from "./db";

interface UpdateUserPlanParams {
  userId: string;
  plan: "basic" | "professional" | "enterprise";
  expiresAt: number;
  paymentProvider?: string;
}

/**
 * Обновляет план пользователя и срок действия подписки в БД
 * После успешной оплаты ЮKassa вызывает эту функцию
 */
export async function updateUserPlan({
  userId,
  plan,
  expiresAt,
  paymentProvider = "yookassa",
}: UpdateUserPlanParams): Promise<void> {
  try {
    const now = Math.floor(Date.now() / 1000);
    await db.execute(
      `UPDATE users SET plan = ?, expiresAt = ?, paymentProvider = ?, updatedAt = ? WHERE id = ?`,
      [plan, expiresAt, paymentProvider, now, userId]
    );
    console.log(
      `[Payments] Updated user ${userId} to plan ${plan}, expires at ${expiresAt}`
    );
  } catch (error) {
    console.error(`[Payments] Error updating user plan:`, error);
    throw error;
  }
}

/**
 * Получает информацию о пользователе из БД для проверки подписки
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
