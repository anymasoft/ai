/**
 * API Endpoint для инициирования платежа через ЮKassa
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

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

// Интерфейсы для ЮKassa API
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

export async function POST(request: NextRequest) {
  try {
    // Проверяем аутентификацию
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session?.user?.email) {
      return NextResponse.json(
        { success: false, error: "Требуется аутентификация" },
        { status: 401 }
      );
    }

    // Парсим тело запроса
    const body = await request.json();
    const { packageKey } = body;

    // Валидируем packageKey
    if (!packageKey || typeof packageKey !== "string") {
      return NextResponse.json(
        { success: false, error: "Требуется packageKey" },
        { status: 400 }
      );
    }

    // Получаем пакет из БД
    const { db } = await import("@/lib/db");
    const packageResult = await db.execute(
      `SELECT key, title, price_rub, generations FROM packages WHERE key = ? AND is_active = 1`,
      [packageKey]
    );

    if (!packageResult.rows || packageResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Пакет не найден" },
        { status: 400 }
      );
    }

    const pkg = packageResult.rows[0] as any;
    const priceRub = pkg.price_rub;
    const amountRubles = (priceRub / 100).toFixed(2);

    // Получаем креденшалы ЮKassa из переменных окружения
    const yooKassaShopId = process.env.YOOKASSA_SHOP_ID;
    const yooKassaApiKey = process.env.YOOKASSA_API_KEY;

    if (!yooKassaShopId || !yooKassaApiKey) {
      console.error("[YooKassa] Missing shop ID or API key");
      return NextResponse.json(
        { success: false, error: "Конфигурация платежной системы неверна" },
        { status: 500 }
      );
    }

    // Создаём платёж через ЮKassa API
    const webhookUrl = `${process.env.NEXTAUTH_URL}/api/payments/yookassa/webhook`;

    console.log("[YooKassa] КОНФИГУРАЦИЯ:");
    console.log("[YooKassa]   - NEXTAUTH_URL =", process.env.NEXTAUTH_URL);
    console.log("[YooKassa]   - webhookUrl =", webhookUrl);
    console.log("[YooKassa]   - Shop ID =", yooKassaShopId ? "✓ SET" : "❌ MISSING");

    const paymentRequest: YooKassaPaymentRequest = {
      amount: {
        value: amountRubles,
        currency: "RUB",
      },
      confirmation: {
        type: "redirect",
        return_url: `${process.env.NEXTAUTH_URL}/settings/billing?success=1`,
      },
      capture: true,
      description: `Пакет ${pkg.title}: ${pkg.generations} генераций - ${session.user.email}`,
    };

    // Отправляем запрос в ЮKassa
    const yooKassaUrl = "https://api.yookassa.ru/v3/payments";
    const auth = Buffer.from(`${yooKassaShopId}:${yooKassaApiKey}`).toString(
      "base64"
    );

    const response = await fetch(yooKassaUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
        "Idempotence-Key": `${session.user.id}-${packageKey}-${Date.now()}`,
      },
      body: JSON.stringify(paymentRequest),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("[YooKassa] Payment creation failed:", errorData);
      return NextResponse.json(
        {
          success: false,
          error:
            errorData.description || "Ошибка при создании платежа в ЮKassa",
        },
        { status: response.status }
      );
    }

    const paymentData = (await response.json()) as YooKassaPaymentResponse;

    // Проверяем, что платёж был создан и имеет confirmation URL
    if (!paymentData.id || !paymentData.confirmation?.confirmation_url) {
      console.error("[YooKassa] Invalid response structure:", paymentData);
      return NextResponse.json(
        { success: false, error: "Неверный ответ от ЮKassa" },
        { status: 500 }
      );
    }

    console.log(
      `[YooKassa] Payment created: ${paymentData.id} for user ${session.user.id}`
    );

    // Сохраняем платёж в БД с status='pending'
    const now = Math.floor(Date.now() / 1000);

    await db.execute(
      `INSERT INTO payments (id, externalPaymentId, userId, packageKey, amount, provider, status, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, 'yookassa', 'pending', ?, ?)`,
      [
        `payment_${Date.now()}_${session.user.id}`,
        paymentData.id,
        session.user.id,
        packageKey,
        parseFloat(amountRubles),
        now,
        now
      ]
    );

    console.log(
      `[YooKassa] Payment saved to DB: ${paymentData.id}, status='pending'`
    );

    return NextResponse.json({
      success: true,
      paymentUrl: paymentData.confirmation.confirmation_url,
      paymentId: paymentData.id,
    });
  } catch (error) {
    console.error("[YooKassa] Unexpected error:", error);
    return NextResponse.json(
      { success: false, error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
