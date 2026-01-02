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

    // ЖЕСТКИЙ RESET: удаляем ВСЕ usage при смене плана
    // Это необходимо, чтобы пользователь получил чистый лимит при смене тарифа
    try {
      const deleteResult = await db.execute(
        `DELETE FROM user_usage_daily WHERE userId = ?`,
        [userId]
      );

      console.log(
        `[updateUserPlan] Reset ALL usage for user ${userId}`
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
 * Получает количество генераций для плана
 */
export function getGenerationsForPlan(
  plan: "basic" | "professional" | "enterprise"
): number {
  const generations: Record<string, number> = {
    basic: 50,
    professional: 250,
    enterprise: 1000,
  };
  return generations[plan] || 0;
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

/**
 * ОБЩАЯ ЛОГИКА АКТИВАЦИИ УСПЕШНОГО ПЛАТЕЖА
 *
 * Вызывается ИЗ:
 * - webhook при payment.succeeded
 * - check endpoint при проверке статуса YooKassa
 *
 * ИДЕМПОТЕНТНА: повторный вызов = ничего не ломает
 * Защита: проверяет payments.status ПЕРЕД UPDATE
 */
export async function applySuccessfulPayment(
  paymentId: string
): Promise<{ success: boolean; reason?: string }> {
  try {
    console.log(`[applySuccessfulPayment] Processing payment: ${paymentId}`);

    // ШАГ 1: Найти платёж в БД
    const paymentResult = await db.execute(
      "SELECT id, userId, planId, status FROM payments WHERE externalPaymentId = ?",
      [paymentId]
    );
    const paymentRows = Array.isArray(paymentResult)
      ? paymentResult
      : paymentResult.rows || [];

    if (paymentRows.length === 0) {
      console.error(
        `[applySuccessfulPayment] ❌ Payment not found: ${paymentId}`
      );
      return { success: false, reason: "Payment not found in DB" };
    }

    const payment = paymentRows[0];
    const { userId, planId, status: currentStatus } = payment;

    console.log(
      `[applySuccessfulPayment] Found payment: userId=${userId}, planId=${planId}, status=${currentStatus}`
    );

    // ШАГ 2: ЗАЩИТА от дублирования — если уже succeeded, ничего не делаем
    if (currentStatus === "succeeded") {
      console.log(
        `[applySuccessfulPayment] ℹ️ Payment already processed (status=succeeded), skipping`
      );
      return { success: true, reason: "Already processed" };
    }

    // ШАГ 3: ЗАЩИТА от незавершённых платежей
    if (currentStatus !== "pending") {
      console.log(
        `[applySuccessfulPayment] ℹ️ Payment has status=${currentStatus}, skipping`
      );
      return { success: false, reason: `Payment status is ${currentStatus}` };
    }

    // ШАГ 4: Определяем количество генераций для плана
    const generationsAmount = getGenerationsForPlan(
      planId as "basic" | "professional" | "enterprise"
    );

    if (generationsAmount === 0) {
      console.error(
        `[applySuccessfulPayment] ❌ Invalid plan ${planId}`
      );
      return { success: false, reason: `Invalid plan: ${planId}` };
    }

    console.log(
      `[applySuccessfulPayment] Adding ${generationsAmount} generations to user ${userId}`
    );

    // ШАГ 5: Увеличиваем generation_balance пользователя
    const now = Math.floor(Date.now() / 1000);
    await db.execute(
      `UPDATE users
       SET generation_balance = generation_balance + ?, updatedAt = ?
       WHERE id = ?`,
      [generationsAmount, now, userId]
    );

    console.log(
      `[applySuccessfulPayment] Updated generation_balance for user ${userId}`
    );

    // ШАГ 6: Обновляем payments.status = 'succeeded'
    await db.execute(
      "UPDATE payments SET status = 'succeeded', updatedAt = ? WHERE externalPaymentId = ?",
      [now, paymentId]
    );

    console.log(
      `[applySuccessfulPayment] ✅ Success! Payment ${paymentId} activated for user ${userId}`
    );

    return { success: true };
  } catch (error) {
    console.error(`[applySuccessfulPayment] Error:`, error);
    return { success: false, reason: "Internal error" };
  }
}
