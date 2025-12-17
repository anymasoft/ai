/**
 * Webhook обработчик для ЮKassa
 * POST /api/payments/yookassa/webhook
 *
 * Получает уведомление о платеже от ЮKassa и логирует его для аудита
 * Верификация платежа происходит через запрос к API ЮKassa
 * ВАЖНО: Webhook НЕ изменяет тариф пользователя (это делает confirm endpoint)
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

    // Webhook НЕ вызывает updateUserPlan (это делает confirm)
    // Webhook только логирует платеж в историю для аудита

    // ИДЕМПОТЕНТНОСТЬ: проверяем, нет ли уже записи о платеже
    const { db } = await import("@/lib/db");
    const checkResult = await db.execute(
      `SELECT 1 FROM payments WHERE provider = 'yookassa' AND externalPaymentId = ? LIMIT 1`,
      [paymentId]
    );
    const existingPayment = Array.isArray(checkResult) ? checkResult.length > 0 : (checkResult.rows || []).length > 0;

    if (existingPayment) {
      console.log(
        `[YooKassa Webhook] Payment ${paymentId} already logged, skipping duplicate insert`
      );
      return NextResponse.json({ success: true });
    }

    // Записываем платеж в историю
    const now = Date.now();
    const expiresAt = now + 30 * 24 * 60 * 60 * 1000; // для логирования
    const { PLAN_LIMITS } = await import("@/config/plan-limits");
    const planPrice = PLAN_LIMITS[planId as "basic" | "professional" | "enterprise"]?.price || "0 ₽";

    await db.execute(
      `INSERT INTO payments (externalPaymentId, userId, plan, amount, provider, status, expiresAt, createdAt)
       VALUES (?, ?, ?, ?, 'yookassa', 'succeeded', ?, ?)`,
      [paymentId, userId, planId, planPrice, expiresAt, now]
    );

    console.log(
      `[YooKassa Webhook] Successfully logged payment ${paymentId} for user ${userId}, plan ${planId}`
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[YooKassa Webhook] Error processing webhook:", error);
    // Возвращаем 200 OK, чтобы ЮKassa не пытался переотправить
    return NextResponse.json({ success: true });
  }
}
