/**
 * Утилиты для работы с платежами через ЮKassa
 */

import { getDb } from './db';

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
  const db = getDb();

  try {
    console.log(`[applySuccessfulPayment] Processing payment: ${paymentId}`);

    // ШАГ 1: Найти платёж в БД
    const paymentStmt = db.prepare(
      'SELECT id, userId, packageKey, status FROM payments WHERE externalPaymentId = ?'
    );
    const payment = paymentStmt.get(paymentId) as any;

    if (!payment) {
      console.error(`[applySuccessfulPayment] ❌ Payment not found: ${paymentId}`);
      return { success: false, reason: 'Payment not found in DB' };
    }

    const { userId, packageKey, status: currentStatus } = payment;

    console.log(
      `[applySuccessfulPayment] Found payment: userId=${userId}, packageKey=${packageKey}, status=${currentStatus}`
    );

    // ШАГ 2: ЗАЩИТА от дублирования — если уже succeeded, ничего не делаем
    if (currentStatus === 'succeeded') {
      console.log(
        `[applySuccessfulPayment] ℹ️ Payment already processed (status=succeeded), skipping`
      );
      return { success: true, reason: 'Already processed' };
    }

    // ШАГ 3: ЗАЩИТА от незавершённых платежей
    if (currentStatus !== 'pending') {
      console.log(
        `[applySuccessfulPayment] ℹ️ Payment has status=${currentStatus}, skipping`
      );
      return { success: false, reason: `Payment status is ${currentStatus}` };
    }

    // ШАГ 4: Получаем количество генераций из packages таблицы
    const pkgStmt = db.prepare('SELECT generations FROM packages WHERE key = ?');
    const pkg = pkgStmt.get(packageKey) as any;

    if (!pkg) {
      console.error(`[applySuccessfulPayment] ❌ Package not found: ${packageKey}`);
      return { success: false, reason: `Package not found: ${packageKey}` };
    }

    const generationsAmount = pkg.generations;

    console.log(
      `[applySuccessfulPayment] Adding ${generationsAmount} generations to user ${userId}`
    );

    // ШАГ 5: Увеличиваем generation_balance пользователя
    const now = Math.floor(Date.now() / 1000);
    const updateUserStmt = db.prepare(
      `UPDATE users
       SET generation_balance = generation_balance + ?, updatedAt = ?
       WHERE id = ?`
    );
    updateUserStmt.run(generationsAmount, now, userId);

    console.log(`[applySuccessfulPayment] Updated generation_balance for user ${userId}`);

    // ШАГ 6: Обновляем payments.status = 'succeeded'
    const updatePaymentStmt = db.prepare(
      "UPDATE payments SET status = 'succeeded', updatedAt = ? WHERE externalPaymentId = ?"
    );
    updatePaymentStmt.run(now, paymentId);

    console.log(
      `[applySuccessfulPayment] ✅ Success! Payment ${paymentId} activated for user ${userId}`
    );

    return { success: true };
  } catch (error) {
    console.error(`[applySuccessfulPayment] Error:`, error);
    return { success: false, reason: 'Internal error' };
  }
}
