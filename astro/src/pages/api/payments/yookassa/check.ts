/**
 * Check Payment Status Endpoint
 * GET /api/payments/yookassa/check
 * GET /api/payments/yookassa/check?paymentId=XXX
 *
 * ПОЛИНГ для проверки статуса платежа (без webhook)
 *
 * ЛОГИКА:
 * 1. Если paymentId → проверяет конкретный платёж
 * 2. Если БЕЗ paymentId → ищет latest pending платёж по userId
 * 3. Проверяет payments.status в БД
 * 4. ЕСЛИ pending → запрашивает YooKassa API
 * 5. ЕСЛИ YooKassa говорит succeeded → применяет платёж через applySuccessfulPayment()
 */

import type { APIRoute } from 'astro';
import { getUserFromSession } from '../../../../lib/auth';
import { getDb } from '../../../../lib/db';
import { applySuccessfulPayment } from '../../../../lib/payments';

interface YooKassaPaymentResponse {
  id: string;
  status: string;
  paid: boolean;
}

export const GET: APIRoute = async (context) => {
  try {
    // Проверяем аутентификацию
    const sessionToken = context.cookies.get('session_token')?.value;
    const user = sessionToken ? getUserFromSession(sessionToken) : null;

    if (!user?.id) {
      return new Response(
        JSON.stringify({ error: 'Требуется аутентификация' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(context.request.url);
    let paymentId = url.searchParams.get('paymentId');


    const db = getDb();

    // ШАГ 1: Если paymentId не передан, ищем latest pending платёж по userId
    if (!paymentId) {

      const latestStmt = db.prepare(
        "SELECT externalPaymentId, status FROM payments WHERE userId = ? AND status = 'pending' ORDER BY createdAt DESC LIMIT 1"
      );
      const latest = latestStmt.get(user.id) as any;

      if (!latest) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'No pending payment found',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      paymentId = latest.externalPaymentId;
    }

    // ШАГ 2: Проверяем статус в БД
    const dbStmt = db.prepare(
      'SELECT status, userId FROM payments WHERE externalPaymentId = ?'
    );
    const dbPayment = dbStmt.get(paymentId) as any;

    if (!dbPayment) {
      return new Response(
        JSON.stringify({ success: false, error: 'Payment not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { status: dbStatus, userId } = dbPayment;

    // Проверяем что платёж принадлежит текущему user
    if (userId !== user.id) {
      console.error(
        `[CHECK] User mismatch: payment.userId=${userId}, session.userId=${user.id}`
      );
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(
      `[CHECK] Found payment in DB: status=${dbStatus}, userId=${userId}`
    );

    // ШАГ 3: ЕСЛИ уже succeeded в БД → готово
    if (dbStatus === 'succeeded') {
      return new Response(
        JSON.stringify({ success: true, status: 'succeeded' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ШАГ 4: ЕСЛИ не pending → ошибка
    if (dbStatus !== 'pending') {
      return new Response(
        JSON.stringify({
          success: false,
          status: dbStatus,
          error: `Payment status is ${dbStatus}`,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ШАГ 5: PULL из YooKassa API (только если pending)

    const yooKassaShopId = process.env.YOOKASSA_SHOP_ID;
    const yooKassaApiKey = process.env.YOOKASSA_API_KEY;

    if (!yooKassaShopId || !yooKassaApiKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const auth = Buffer.from(`${yooKassaShopId}:${yooKassaApiKey}`).toString(
      'base64'
    );

    const yooKassaUrl = `https://api.yookassa.ru/v3/payments/${paymentId}`;
    const response = await fetch(yooKassaUrl, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return new Response(
        JSON.stringify({
          success: false,
          status: 'pending',
          error: 'Could not verify payment with YooKassa',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const yooKassaPayment = (await response.json()) as YooKassaPaymentResponse;

    console.log(
      `[CHECK] YooKassa response: status=${yooKassaPayment.status}, paid=${yooKassaPayment.paid}`
    );

    // ШАГ 6: ЕСЛИ YooKassa говорит succeeded → применяем платёж
    if (
      yooKassaPayment.status === 'succeeded' &&
      yooKassaPayment.paid === true
    ) {

      // Используем ту же функцию
      const applyResult = await applySuccessfulPayment(paymentId);


      if (applyResult.success) {
        // Получаем обновленный баланс для логирования
        const updatedUserStmt = db.prepare('SELECT generation_balance FROM users WHERE id = ?');
        const updatedUser = updatedUserStmt.get(user.id) as any;
        const newBalance = updatedUser?.generation_balance ?? 0;

        return new Response(
          JSON.stringify({ success: true, status: 'succeeded' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      } else {
        return new Response(
          JSON.stringify({
            success: false,
            status: 'error',
            error: applyResult.reason,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

    // ШАГ 7: ЕСЛИ ещё pending → возвращаем pending
    return new Response(
      JSON.stringify({
        success: false,
        status: 'pending',
        message: 'Payment is still processing',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
