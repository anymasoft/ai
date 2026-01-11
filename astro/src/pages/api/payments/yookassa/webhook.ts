/**
 * Webhook обработчик для ЮKassa
 * POST /api/payments/yookassa/webhook
 *
 * ЕДИНСТВЕННАЯ ТОЧКА АКТИВАЦИИ ПЛАТЕЖА (в PROD)
 * Получает уведомление о платеже от ЮKassa и обновляет баланс пользователя в БД
 */

import type { APIRoute } from 'astro';
import { applySuccessfulPayment } from '../../../../lib/payments';

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

export const POST: APIRoute = async (context) => {
  try {
    const body = (await context.request.json()) as YooKassaWebhookEvent;

    console.log('[WEBHOOK] Event received: type =', body.type, 'event =', body.event);

    // Обрабатываем ТОЛЬКО payment.succeeded
    if (body.type !== 'notification' || body.event !== 'payment.succeeded') {
      console.log(`[WEBHOOK] Skipping event: ${body.event}`);
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    }

    const paymentId = body.data.object.id;
    console.log(`[WEBHOOK] ✓ Processing payment.succeeded: ${paymentId}`);

    // ИСПОЛЬЗУЕМ ОБЩУЮ ФУНКЦИЮ (та же, что и в check endpoint)
    const result = await applySuccessfulPayment(paymentId);

    if (result.success) {
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    } else {
      console.error(`[WEBHOOK] Failed to apply payment:`, result.reason);
      // Возвращаем 500 чтобы YooKassa повторил попытку
      return new Response(
        JSON.stringify({ success: false, error: result.reason }),
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[WEBHOOK] Error:', error);
    // Возвращаем 200 OK (но логируем ошибку)
    // YooKassa уже отправит повторно если нужно
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  }
};
