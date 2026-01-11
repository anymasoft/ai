/**
 * API Endpoint для инициирования платежа через ЮКassa
 * POST /api/payments/yookassa/create
 *
 * Body:
 * {
 *   packageKey: "basic" | "pro" | "enterprise"
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
    const { packageKey } = body;

    // Валидируем packageKey
    if (!packageKey || typeof packageKey !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'Требуется packageKey' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Получаем пакет из БД
    const db = getDb();
    const pkgStmt = db.prepare(
      `SELECT key, title, price_rub, generations FROM packages WHERE key = ? AND is_active = 1`
    );
    const pkg = pkgStmt.get(packageKey) as any;

    if (!pkg) {
      return new Response(
        JSON.stringify({ success: false, error: 'Пакет не найден' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const priceRub = pkg.price_rub;

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
      description: `Пакет ${pkg.title}: ${pkg.generations} генераций - ${user.email}`,
    };

    // Отправляем запрос в ЮKassa
    const yooKassaUrl = 'https://api.yookassa.ru/v3/payments';
    const auth = Buffer.from(`${yooKassaShopId}:${yooKassaApiKey}`).toString('base64');

    const response = await fetch(yooKassaUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
        'Idempotence-Key': `${user.id}-${packageKey}-${Date.now()}`,
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

    console.log(`[YooKassa] Payment created: ${paymentData.id} for user ${user.id}`);

    // Сохраняем платёж в БД с status='pending'
    const now = Math.floor(Date.now() / 1000);
    const insertStmt = db.prepare(
      `INSERT INTO payments (id, externalPaymentId, userId, packageKey, amount, provider, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, 'yookassa', 'pending', ?, ?)`
    );

    insertStmt.run(
      `payment_${Date.now()}_${user.id}`,
      paymentData.id,
      user.id,
      packageKey,
      priceRub,
      now,
      now
    );

    console.log(`[YooKassa] Payment saved to DB: ${paymentData.id}, status='pending'`);

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
