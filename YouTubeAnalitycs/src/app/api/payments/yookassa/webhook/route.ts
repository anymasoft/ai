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

    console.log("[WEBHOOK] ПОЛНОЕ СОБЫТИЕ =", JSON.stringify(body, null, 2));
    console.log("[WEBHOOK] Event type =", body.type, "event =", body.event);

    // Обрабатываем ТОЛЬКО payment.succeeded
    if (body.type !== "notification" || body.event !== "payment.succeeded") {
      console.log(`[YooKassa Webhook] Пропускаем событие: ${body.event}`);
      return NextResponse.json({ success: true });
    }

    const paymentId = body.data.object.id;
    console.log(`[WEBHOOK] payment.succeeded найдено, paymentId = ${paymentId}`);

    // Импортируем БД
    const { db } = await import("@/lib/db");

    // ШАГ 1: Ищем платёж в БД по externalPaymentId
    const result = await db.execute(
      "SELECT id, userId, plan, status FROM payments WHERE externalPaymentId = ?",
      [paymentId]
    );
    const rows = Array.isArray(result) ? result : result.rows || [];

    console.log("[WEBHOOK] Результат SELECT из payments table =", rows);

    if (rows.length === 0) {
      console.error(`[WEBHOOK] ❌ ПЛАТЁЖ ${paymentId} НЕ НАЙДЕН В БД payments`);
      console.error("[WEBHOOK] Это значит create/route.ts НЕ СОХРАНИЛ платеж ИЛИ СОХРАНИЛ С ДРУГИМ paymentId");
      // Возвращаем 500 чтобы YooKassa повторил попытку
      return NextResponse.json(
        { success: false, error: "Payment not found" },
        { status: 500 }
      );
    }

    const payment = rows[0];
    const { userId, plan: planId, status: currentStatus } = payment;

    console.log("[WEBHOOK] 🟢 ПЛАТЁЖ НАЙДЕН:");
    console.log("[WEBHOOK]   - userId =", userId);
    console.log("[WEBHOOK]   - plan =", planId);
    console.log("[WEBHOOK]   - status =", currentStatus);

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

    console.log("[WEBHOOK] Активирую тариф:");
    console.log("[WEBHOOK]   - userId =", userId);
    console.log("[WEBHOOK]   - plan =", planId);
    console.log("[WEBHOOK]   - expiresAt =", expiresAt, `(${new Date(expiresAt * 1000).toISOString()})`);

    // ШАГ 4: Обновляем users (активация тарифа)
    const updateResult = await db.execute(
      `UPDATE users SET plan = ?, expiresAt = ?, paymentProvider = 'yookassa', updatedAt = ? WHERE id = ?`,
      [planId, expiresAt, now, userId]
    );

    console.log("[WEBHOOK] Результат UPDATE users =", updateResult);

    console.log("[WEBHOOK] ✅ Успешно обновлен план для пользователя:")
    console.log(`[WEBHOOK]   userId ${userId}: ${planId}, истекает в ${expiresAt}`);

    // ШАГ 5: Обновляем payments (статус + дата)
    const paymentsUpdateResult = await db.execute(
      `UPDATE payments SET status = 'succeeded', expiresAt = ? WHERE externalPaymentId = ?`,
      [expiresAt, paymentId]
    );

    console.log("[WEBHOOK] Результат UPDATE payments =", paymentsUpdateResult);

    // ШАГ 6: ПРОВЕРКА - читаем обновленного user из БД
    const verifyResult = await db.execute(
      "SELECT id, plan, expiresAt FROM users WHERE id = ?",
      [userId]
    );
    const verifyRows = Array.isArray(verifyResult) ? verifyResult : verifyResult.rows || [];
    const verifiedUser = verifyRows[0];

    console.log("[WEBHOOK] ✅ ПРОВЕРКА - прочитал user из БД после UPDATE:");
    console.log("[WEBHOOK]   - id =", verifiedUser?.id);
    console.log("[WEBHOOK]   - plan =", verifiedUser?.plan, "(должно быть =", planId, ")");
    console.log("[WEBHOOK]   - expiresAt =", verifiedUser?.expiresAt);

    if (verifiedUser?.plan !== planId) {
      console.error("[WEBHOOK] ❌ КРИТИЧЕСКАЯ ОШИБКА! план в БД НЕ СОВПАДАЕТ!");
      console.error("[WEBHOOK] Ожидал:", planId);
      console.error("[WEBHOOK] Получил:", verifiedUser?.plan);
    }

    console.log(
      `[WEBHOOK] ✅ УСПЕШНО! Платёж ${paymentId} обработан для пользователя ${userId}`
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[YooKassa Webhook] Ошибка обработки webhook:", error);
    // Возвращаем 200 OK (но логируем ошибку)
    // YooKassa уже отправит повторно если нужно
    return NextResponse.json({ success: true });
  }
}
