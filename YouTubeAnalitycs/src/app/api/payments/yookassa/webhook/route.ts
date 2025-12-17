/**
 * Webhook обработчик для ЮKassa
 * POST /api/payments/yookassa/webhook
 *
 * ЕДИНСТВЕННАЯ ТОЧКА АКТИВАЦИИ ТАРИФА
 * Получает уведомление о платеже от ЮKassa и обновляет тариф пользователя в БД
 */

import { NextRequest, NextResponse } from "next/server";

interface YooKassaWebhookEvent {
  type: string;
  event: string;
  data: {
    object: {
      id: string;
      status: string;
      paid: boolean;
    };
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as YooKassaWebhookEvent;

    // Обрабатываем ТОЛЬКО payment.succeeded
    if (body.type !== "notification" || body.event !== "payment.succeeded") {
      console.log(`[YooKassa Webhook] Пропускаем событие: ${body.event}`);
      return NextResponse.json({ success: true });
    }

    const paymentId = body.data.object.id;
    console.log(`[YooKassa Webhook] Обработка платежа: ${paymentId}`);

    // Импортируем БД
    const { db } = await import("@/lib/db");

    // ШАГ 1: Ищем платёж в БД по externalPaymentId
    const result = await db.execute(
      "SELECT id, userId, plan, status FROM payments WHERE externalPaymentId = ?",
      [paymentId]
    );
    const rows = Array.isArray(result) ? result : result.rows || [];

    if (rows.length === 0) {
      console.error(`[YooKassa Webhook] Платёж ${paymentId} не найден в БД`);
      // Возвращаем 500 чтобы YooKassa повторил попытку
      return NextResponse.json(
        { success: false, error: "Payment not found" },
        { status: 500 }
      );
    }

    const payment = rows[0];
    const { userId, plan: planId, status: currentStatus } = payment;

    // ШАГ 2: Проверяем статус (идемпотентность)
    if (currentStatus === "succeeded") {
      console.log(`[YooKassa Webhook] Платёж ${paymentId} уже обработан (идемпотентность)`);
      return NextResponse.json({ success: true });
    }

    if (currentStatus !== "pending") {
      console.log(`[YooKassa Webhook] Платёж ${paymentId} имеет статус ${currentStatus}, пропускаем`);
      return NextResponse.json({ success: true });
    }

    // ШАГ 3: Активируем тариф на 30 дней
    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysInSeconds = 30 * 24 * 60 * 60;
    const expiresAt = now + thirtyDaysInSeconds;

    // ШАГ 4: Обновляем users (активация тарифа)
    await db.execute(
      `UPDATE users SET plan = ?, expiresAt = ?, paymentProvider = 'yookassa', updatedAt = ? WHERE id = ?`,
      [planId, expiresAt, now, userId]
    );

    console.log(
      `[YooKassa Webhook] Обновлен план для пользователя ${userId}: ${planId}, истекает в ${expiresAt}`
    );

    // ШАГ 5: Обновляем payments (статус + дата)
    await db.execute(
      `UPDATE payments SET status = 'succeeded', expiresAt = ? WHERE externalPaymentId = ?`,
      [expiresAt, paymentId]
    );

    console.log(
      `[YooKassa Webhook] Платёж ${paymentId} успешно обработан для пользователя ${userId}`
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[YooKassa Webhook] Ошибка обработки webhook:", error);
    // Возвращаем 200 OK (но логируем ошибку)
    // YooKassa уже отправит повторно если нужно
    return NextResponse.json({ success: true });
  }
}
