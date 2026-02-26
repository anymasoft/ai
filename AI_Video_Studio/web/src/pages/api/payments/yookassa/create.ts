/**
 * API Endpoint для инициирования платежа через ЮКassa
 * POST /api/payments/yookassa/create
 *
 * Body:
 * {
 *   credits: number (количество кредитов для покупки)
 *   amount: number (сумма в рублях)
 * }
 *
 * Response:
 * {
 *   success: boolean
 *   paymentUrl?: string
 *   paymentId?: string
 *   error?: string
 * }
 */

import type { APIRoute } from 'astro';
import { getUserFromSession } from '../../../../lib/auth';
import { getDb } from '../../../../lib/db';

interface YooKassaPaymentRequest {
  amount: {
    value: string;
    currency: string;
  };
  confirmation: {
    type: string;
    return_url: string;
  };
  capture: boolean;
  description: string;
}

interface YooKassaPaymentResponse {
  id: string;
  status: string;
  amount: {
    value: string;
    currency: string;
  };
  confirmation: {
    type: string;
    confirmation_url: string;
  };
}

export const POST: APIRoute = async (context) => {
  try {
    // Проверяем аутентификацию
    const sessionToken = context.cookies.get('session_token')?.value;
    const user = sessionToken ? getUserFromSession(sessionToken) : null;

    if (!user?.id || !user?.email) {
      return new Response(
        JSON.stringify({ success: false, error: 'Требуется аутентификация' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Парсим тело запроса
    const body = await context.request.json() as any;
    const { credits, amount } = body;

    // Валидируем параметры
    if (!credits || typeof credits !== 'number' || credits < 1) {
      return new Response(
        JSON.stringify({ success: false, error: 'Требуется валидное количество кредитов' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!amount || typeof amount !== 'number' || amount < 1) {
      return new Response(
        JSON.stringify({ success: false, error: 'Требуется валидная сумма' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const priceRub = amount;
    const creditsAmount = credits;

    // Получаем креденшалы ЮKassa из переменных окружения
    const yooKassaShopId = process.env.YOOKASSA_SHOP_ID;
    const yooKassaApiKey = process.env.YOOKASSA_API_KEY;
    const authUrl = process.env.AUTH_URL || 'http://localhost:4321';

    if (!yooKassaShopId || !yooKassaApiKey) {
      console.error('[YooKassa] Missing shop ID or API key');
      return new Response(
        JSON.stringify({ success: false, error: 'Конфигурация платежной системы неверна' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Создаём платёж через ЮKassa API
    const webhookUrl = `${authUrl}/api/payments/yookassa/webhook`;

    console.log('[YooKassa] КОНФИГУРАЦИЯ:');
    console.log('[YooKassa]   - authUrl =', authUrl);
    console.log('[YooKassa]   - webhookUrl =', webhookUrl);
    console.log('[YooKassa]   - Shop ID =', yooKassaShopId ? '✓ SET' : '❌ MISSING');

    const description = `Покупка ${creditsAmount} кредитов - ${user.email}`;

    const paymentRequest: YooKassaPaymentRequest = {
      amount: {
        value: priceRub.toString(),
        currency: 'RUB',
      },
      confirmation: {
        type: 'redirect',
        return_url: `${authUrl}/billing?success=1`,
      },
      capture: true,
      description: description,
    };

    // Отправляем запрос в ЮKassa
    const yooKassaUrl = 'https://api.yookassa.ru/v3/payments';
    const auth = Buffer.from(`${yooKassaShopId}:${yooKassaApiKey}`).toString('base64');

    const response = await fetch(yooKassaUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
        'Idempotence-Key': `${user.id}-${creditsAmount}-${Date.now()}`,
      },
      body: JSON.stringify(paymentRequest),
    });

    if (!response.ok) {
      const errorData = await response.json() as any;
      console.error('[YooKassa] Payment creation failed:', errorData);
      return new Response(
        JSON.stringify({
          success: false,
          error: errorData.description || 'Ошибка при создании платежа в ЮKassa',
        }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const paymentData = (await response.json()) as YooKassaPaymentResponse;

    // Проверяем, что платёж был создан и имеет confirmation URL
    if (!paymentData.id || !paymentData.confirmation?.confirmation_url) {
      console.error('[YooKassa] Invalid response structure:', paymentData);
      return new Response(
        JSON.stringify({ success: false, error: 'Неверный ответ от ЮKassa' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[CREATE] ✅ Payment created in YooKassa: ${paymentData.id}`);
    console.log(`[CREATE] Payment details: amount=${priceRub}₽, credits=${creditsAmount}, user=${user.id}`);

    // Сохраняем платёж в БД с status='pending'
    const db = getDb();
    const now = Math.floor(Date.now() / 1000);
    const insertStmt = db.prepare(
      `INSERT INTO payments (id, externalPaymentId, userId, amount, credits, provider, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, 'yookassa', 'pending', ?, ?)`
    );

    const dbPaymentId = `payment_${Date.now()}_${user.id}`;
    insertStmt.run(
      dbPaymentId,
      paymentData.id,
      user.id,
      priceRub,
      creditsAmount,
      now,
      now
    );

    console.log(`[CREATE] ✅ Payment saved to DB: ${paymentData.id}, local_id=${dbPaymentId}, status=pending`);

    return new Response(
      JSON.stringify({
        success: true,
        paymentUrl: paymentData.confirmation.confirmation_url,
        paymentId: paymentData.id,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[YooKassa] Unexpected error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Внутренняя ошибка сервера' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
