/**
 * Webhook обработчик для ЮKassa
 * POST /api/payments/yookassa/webhook
 *
 * ЕДИНСТВЕННАЯ ТОЧКА АКТИВАЦИИ ТАРИФА (в PROD)
 * Получает уведомление о платеже от ЮKassa и обновляет тариф пользователя в БД
 */

import { NextRequest, NextResponse } from "next/server";
import { applySuccessfulPayment } from "@/lib/payments";

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

    console.log("[WEBHOOK] Event received: type =", body.type, "event =", body.event);

    // Обрабатываем ТОЛЬКО payment.succeeded
    if (body.type !== "notification" || body.event !== "payment.succeeded") {
      console.log(`[WEBHOOK] Skipping event: ${body.event}`);
      return NextResponse.json({ success: true });
    }

    const paymentId = body.data.object.id;
    console.log(`[WEBHOOK] ✓ Processing payment.succeeded: ${paymentId}`);

    // ИСПОЛЬЗУЕМ ОБЩУЮ ФУНКЦИЮ (та же, что и в check endpoint)
    const result = await applySuccessfulPayment(paymentId);

    if (result.success) {
      return NextResponse.json({ success: true });
    } else {
      console.error(`[WEBHOOK] Failed to apply payment:`, result.reason);
      // Возвращаем 500 чтобы YooKassa повторил попытку
      return NextResponse.json(
        { success: false, error: result.reason },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[WEBHOOK] Error:", error);
    // Возвращаем 200 OK (но логируем ошибку)
    // YooKassa уже отправит повторно если нужно
    return NextResponse.json({ success: true });
  }
}
