/**
 * Webhook обработчик для ЮKassa
 * POST /api/payments/yookassa/webhook
 *
 * ЕДИНСТВЕННАЯ ТОЧКА АКТИВАЦИИ ТАРИФА
 * Получает уведомление о платеже от ЮKassa и:
 * 1. Проверяет идемпотентность
 * 2. Активирует тариф пользователя (UPDATE users)
 * 3. Логирует платеж в историю
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
      amount: {
        value: string;
        currency: string;
      };
      metadata?: {
        userId?: string;
        planId?: string;
      };
    };
  };
}

interface YooKassaPayment {
  id: string;
  status: string;
  paid: boolean;
  amount: {
    value: string;
    currency: string;
  };
  metadata?: {
    userId?: string;
    planId?: string;
  };
}

/**
 * Проверяет платеж через API ЮKassa
 * Использует Basic Auth с YOOKASSA_SHOP_ID и YOOKASSA_SECRET_KEY
 */
async function verifyPaymentWithAPI(paymentId: string): Promise<YooKassaPayment | null> {
  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_SECRET_KEY;

  if (!shopId || !secretKey) {
    console.error("[YooKassa Webhook] Missing YOOKASSA_SHOP_ID or YOOKASSA_SECRET_KEY");
    return null;
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
      console.error(`[YooKassa Webhook] API verification failed: ${response.status} ${response.statusText}`);
      return null;
    }

    const payment = (await response.json()) as YooKassaPayment;
    return payment;
  } catch (error) {
    console.error("[YooKassa Webhook] Error verifying payment with API:", error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as YooKassaWebhookEvent;

    // Проверяем тип события - нас интересуют успешные платежи
    if (body.type !== "notification" || body.event !== "payment.succeeded") {
      console.log(`[YooKassa Webhook] Skipping event type: ${body.type}, event: ${body.event}`);
      return NextResponse.json({ success: true });
    }

    const paymentId = body.data.object.id;

    // Проверяем платеж через API ЮKassa
    const payment = await verifyPaymentWithAPI(paymentId);
    if (!payment) {
      console.error(`[YooKassa Webhook] Failed to verify payment ${paymentId} via API`);
      return NextResponse.json({ success: true });
    }

    // Проверяем статус платежа
    if (payment.status !== "succeeded" || !payment.paid) {
      console.log(
        `[YooKassa Webhook] Payment ${paymentId} status is ${payment.status}, paid: ${payment.paid}, skipping`
      );
      return NextResponse.json({ success: true });
    }

    // Проверяем метаданные
    const { userId, planId } = payment.metadata || {};
    if (!userId || !planId) {
      console.error(
        `[YooKassa Webhook] Payment ${paymentId} missing metadata: userId=${userId}, planId=${planId}`
      );
      return NextResponse.json({ success: true });
    }

    // Валидируем planId
    if (!["basic", "professional", "enterprise"].includes(planId)) {
      console.error(`[YooKassa Webhook] Payment ${paymentId} invalid planId: ${planId}`);
      return NextResponse.json({ success: true });
    }

    const { db } = await import("@/lib/db");

    // ШАГ 1: ИДЕМПОТЕНТНОСТЬ - проверяем ДО любых действий
    console.log(`[YooKassa Webhook] Checking idempotency for payment ${paymentId}`);
    const checkResult = await db.execute(
      `SELECT 1 FROM payments WHERE provider = 'yookassa' AND externalPaymentId = ? LIMIT 1`,
      [paymentId]
    );
    const existingPayment = Array.isArray(checkResult) ? checkResult.length > 0 : (checkResult.rows || []).length > 0;

    if (existingPayment) {
      console.log(
        `[YooKassa Webhook] Payment ${paymentId} already processed, returning success`
      );
      return NextResponse.json({ success: true });
    }

    // ШАГ 2: АКТИВАЦИЯ ТАРИФА (обновляем users)
    const now = Date.now();
    const expiresAt = now + 30 * 24 * 60 * 60 * 1000; // ровно 30 дней

    console.log(`[YooKassa Webhook] Activating plan ${planId} for user ${userId}, expires at ${expiresAt}`);

    await db.execute(
      `UPDATE users SET plan = ?, expiresAt = ?, paymentProvider = 'yookassa', updatedAt = ? WHERE id = ?`,
      [planId, expiresAt, now, userId]
    );

    console.log(`[YooKassa Webhook] Successfully updated user ${userId} plan to ${planId}`);

    // ШАГ 3: ЛОГ ПЛАТЕЖА (записываем в историю)
    const { PLAN_LIMITS } = await import("@/config/plan-limits");
    const planPrice = PLAN_LIMITS[planId as "basic" | "professional" | "enterprise"]?.price || "0 ₽";

    await db.execute(
      `INSERT INTO payments (externalPaymentId, userId, plan, amount, provider, status, expiresAt, createdAt)
       VALUES (?, ?, ?, ?, 'yookassa', 'succeeded', ?, ?)`,
      [paymentId, userId, planId, planPrice, expiresAt, now]
    );

    console.log(
      `[YooKassa Webhook] Successfully processed payment ${paymentId} for user ${userId}, plan ${planId}`
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[YooKassa Webhook] Error processing webhook:", error);
    // Возвращаем 200 OK, чтобы ЮKassa не пытался переотправить
    return NextResponse.json({ success: true });
  }
}
