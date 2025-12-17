/**
 * Endpoint для проверки статуса платежа через YooKassa API
 * GET /api/payments/yookassa/confirm?paymentId=XXX
 *
 * ВНИМАНИЕ: НЕ активирует подписку пользователя!
 * Активация тарифа происходит ТОЛЬКО через webhook.
 * Этот endpoint просто проверяет статус платежа для информации.
 *
 * Response:
 * {
 *   ok: boolean
 *   status?: string
 *   error?: string
 * }
 */

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

interface YooKassaPayment {
  id: string;
  status: string;
  metadata?: {
    userId?: string;
    planId?: string;
  };
}

export async function GET(request: NextRequest) {
  try {
    // Получаем paymentId из параметров
    const paymentId = request.nextUrl.searchParams.get("paymentId");

    console.log(`[YooKassa Confirm] GET request received, paymentId: ${paymentId}`);

    if (!paymentId) {
      console.log('[YooKassa Confirm] Missing paymentId parameter');
      return NextResponse.json(
        { ok: false, error: "paymentId обязателен" },
        { status: 400 }
      );
    }

    // Проверяем аутентификацию
    const session = await getServerSession(authOptions);
    console.log(`[YooKassa Confirm] Session check - userId: ${session?.user?.id}`);

    if (!session?.user?.id) {
      console.log('[YooKassa Confirm] Not authenticated');
      return NextResponse.json(
        { ok: false, error: "Требуется аутентификация" },
        { status: 401 }
      );
    }

    // Получаем информацию о платеже из ЮKassa
    const yooKassaShopId = process.env.YOOKASSA_SHOP_ID;
    const yooKassaApiKey = process.env.YOOKASSA_API_KEY;

    if (!yooKassaShopId || !yooKassaApiKey) {
      console.error("[YooKassa Confirm] Missing shop ID or API key");
      return NextResponse.json(
        { ok: false, error: "Конфигурация платежной системы неверна" },
        { status: 500 }
      );
    }

    // Запрашиваем информацию о платеже
    const yooKassaUrl = `https://api.yookassa.ru/v3/payments/${paymentId}`;
    const auth = Buffer.from(`${yooKassaShopId}:${yooKassaApiKey}`).toString(
      "base64"
    );

    const response = await fetch(yooKassaUrl, {
      method: "GET",
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("[YooKassa Confirm] Failed to fetch payment:", errorData);
      return NextResponse.json(
        { ok: false, error: "Платёж не найден или ошибка при запросе" },
        { status: response.status }
      );
    }

    const paymentData = (await response.json()) as YooKassaPayment;

    console.log(
      `[YooKassa Confirm] Payment received from API:`,
      JSON.stringify({
        id: paymentData.id,
        status: paymentData.status
      })
    );

    // Проверяем статус платежа
    if (paymentData.status !== "succeeded") {
      console.log(
        `[YooKassa Confirm] Payment status is ${paymentData.status}, not succeeded`
      );
      return NextResponse.json({
        ok: false,
        status: paymentData.status,
        error: `Платёж не оплачен (статус: ${paymentData.status})`,
      });
    }

    console.log(`[YooKassa Confirm] Payment ${paymentId} is succeeded`);

    // Активация тарифа УЖЕ произошла в webhook!
    // Здесь мы просто подтверждаем статус платежа
    return NextResponse.json({ ok: true, status: "succeeded" });
  } catch (error) {
    console.error("[YooKassa Confirm] Unexpected error:", error);
    return NextResponse.json(
      { ok: false, error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
