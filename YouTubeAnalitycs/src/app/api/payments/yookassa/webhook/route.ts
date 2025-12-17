/**
 * Webhook обработчик для ЮKassa
 * POST /api/payments/yookassa/webhook
 *
 * ЕДИНСТВЕННАЯ ТОЧКА АКТИВАЦИИ ТАРИФА
 * Получает уведомление о платеже от ЮKassa и:
 * 1. Находит платеж в БД по externalPaymentId
 * 2. Активирует тариф пользователя (UPDATE users)
 * 3. Обновляет статус платежа (UPDATE payments status='succeeded')
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

/**
 * Проверяет платеж через API ЮKassa
 */
async function verifyPaymentWithAPI(paymentId: string): Promise<boolean> {
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_SECRET_KEY;

  if (!shopId || !secretKey) {
    console.error("[YooKassa Webhook] Missing YOOKASSA_SHOP_ID or YOOKASSA_SECRET_KEY");
    return false;
  }

  try {
    const auth = Buffer.from(`${shopId}:${secretKey}`).toString("base64");

    const response = await fetch(`https://api.yookassa.ru/v3/payments/${paymentId}`, {
      method: "GET",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/json",
        "Idempotency-Key": paymentId,
      },
    });

    if (!response.ok) {
      console.error(`[YooKassa Webhook] API verification failed: ${response.status}`);
      return false;
    }

    const payment = await response.json() as { status: string; paid: boolean };
    return payment.status === "succeeded" && payment.paid === true;
  } catch (error) {
    console.error("[YooKassa Webhook] Error verifying payment with API:", error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as YooKassaWebhookEvent;

    // Принимаем ТОЛЬКО event payment.succeeded
    if (body.type !== "notification" || body.event !== "payment.succeeded") {
      console.log(`[YooKassa Webhook] Skipping event: ${body.event}`);
      return NextResponse.json({ success: true });
    }

    const paymentId = body.data.object.id;
    console.log(`[YooKassa Webhook] Received payment.succeeded for ${paymentId}`);

    // Проверяем платеж в YooKassa API
    const isValid = await verifyPaymentWithAPI(paymentId);
    if (!isValid) {
      console.error(`[YooKassa Webhook] Payment ${paymentId} verification failed`);
      return NextResponse.json({ success: true });
    }

    const { db } = await import("@/lib/db");

    // ШАГ 1: НАХОДИМ ПЛАТЕЖ В БД
    console.log(`[YooKassa Webhook] Looking for payment ${paymentId} in DB`);
    const searchResult = await db.execute(
      `SELECT userId, plan, status FROM payments
       WHERE provider = 'yookassa' AND externalPaymentId = ? LIMIT 1`,
      [paymentId]
    );

    const paymentRecords = Array.isArray(searchResult) ? searchResult : searchResult.rows || [];
    if (paymentRecords.length === 0) {
      console.error(`[YooKassa Webhook] Payment ${paymentId} NOT FOUND in DB!`);
      // Платеж не найден в БД - это ошибка, YooKassa должна ретраить
      return NextResponse.json({ success: false }, { status: 500 });
    }

    const paymentRecord = paymentRecords[0] as {
      userId: string;
      plan: string;
      status: string;
    };

    console.log(
      `[YooKassa Webhook] Found payment in DB: userId=${paymentRecord.userId}, plan=${paymentRecord.plan}, status=${paymentRecord.status}`
    );

    // ШАГ 2: ИДЕМПОТЕНТНОСТЬ
    if (paymentRecord.status === "succeeded") {
      console.log(`[YooKassa Webhook] Payment ${paymentId} already succeeded, returning 200`);
      return NextResponse.json({ success: true });
    }

    // ШАГ 3: АКТИВИРУЕМ ТАРИФ
    const now = Date.now();
    const expiresAt = now + 30 * 24 * 60 * 60 * 1000; // 30 дней

    console.log(`[YooKassa Webhook] Activating plan ${paymentRecord.plan} for user ${paymentRecord.userId}`);

    await db.execute(
      `UPDATE users SET plan = ?, expiresAt = ?, paymentProvider = 'yookassa', updatedAt = ?
       WHERE id = ?`,
      [paymentRecord.plan, expiresAt, now, paymentRecord.userId]
    );

    // ШАГ 4: ОБНОВЛЯЕМ СТАТУС ПЛАТЕЖА
    await db.execute(
      `UPDATE payments SET status = 'succeeded', expiresAt = ?, updatedAt = ?
       WHERE externalPaymentId = ?`,
      [expiresAt, now, paymentId]
    );

    console.log(
      `[YooKassa Webhook] Successfully processed payment ${paymentId}: user ${paymentRecord.userId} plan=${paymentRecord.plan}`
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[YooKassa Webhook] Error processing webhook:", error);
    // Ошибка при обработке - возвращаем 500 чтобы YooKassa ретраила
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
