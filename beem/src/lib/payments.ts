/**
 * Утилиты для работы с платежами через ЮKassa
 */

import { db } from "./db";

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
      "SELECT id, userId, packageKey, status FROM payments WHERE externalPaymentId = ?",
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
    const { userId, packageKey, status: currentStatus } = payment;

    console.log(
      `[applySuccessfulPayment] Found payment: userId=${userId}, packageKey=${packageKey}, status=${currentStatus}`
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

    // ШАГ 4: Получаем количество генераций из packages таблицы
    const packageResult = await db.execute(
      "SELECT generations FROM packages WHERE key = ?",
      [packageKey]
    );
    const packageRows = Array.isArray(packageResult)
      ? packageResult
      : packageResult.rows || [];

    if (packageRows.length === 0) {
      console.error(
        `[applySuccessfulPayment] ❌ Package not found: ${packageKey}`
      );
      return { success: false, reason: `Package not found: ${packageKey}` };
    }

    const generationsAmount = packageRows[0].generations;

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
