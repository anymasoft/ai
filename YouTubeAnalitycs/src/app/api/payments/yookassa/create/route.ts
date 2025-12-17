/**
 * API Endpoint для инициирования платежа через ЮKassa
 * POST /api/payments/yookassa/create
 *
 * Body:
 * {
 *   planId: "basic" | "professional" | "enterprise"
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
import { getPlanPrice, getPlanName } from "@/lib/payments";
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
    const { planId } = body;

    // Валидируем planId
    if (!planId || !["basic", "professional", "enterprise"].includes(planId)) {
      return NextResponse.json(
        { success: false, error: "Неверный ID тариф" },
        { status: 400 }
      );
    }

    // Получаем цену тариф в копейках
    const amountCopecks = getPlanPrice(
      planId as "basic" | "professional" | "enterprise"
    );
    if (amountCopecks === 0) {
      return NextResponse.json(
        { success: false, error: "Не удалось определить цену тариф" },
        { status: 400 }
      );
    }

    // Конвертируем копейки в рубли (строка)
    const amountRubles = (amountCopecks / 100).toFixed(2);

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
      description: `Подписка на тариф ${getPlanName(
        planId as "basic" | "professional" | "enterprise"
      )} - ${session.user.email}`,
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
        "Idempotence-Key": `${session.user.id}-${planId}-${Date.now()}`,
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

    // СОХРАНЯЕМ ПЛАТЕЖ В НАШЕЙ БД С СТАТУСОМ 'pending'
    const { db } = await import("@/lib/db");
    const now = Date.now();
    const { PLAN_LIMITS } = await import("@/config/plan-limits");
    const planPrice = PLAN_LIMITS[planId as "basic" | "professional" | "enterprise"]?.price || "0 ₽";

    await db.execute(
      `INSERT INTO payments (externalPaymentId, userId, plan, amount, provider, status, createdAt)
       VALUES (?, ?, ?, ?, 'yookassa', 'pending', ?)`,
      [paymentData.id, session.user.id, planId, planPrice, now]
    );

    console.log(
      `[YooKassa] Payment record saved in DB: ${paymentData.id}, status='pending'`
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
