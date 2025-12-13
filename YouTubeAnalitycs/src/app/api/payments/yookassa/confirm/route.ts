/**
 * DEV-ONLY Endpoint для подтверждения платежа локально
 * GET /api/payments/yookassa/confirm?paymentId=XXX
 *
 * Используется для локального тестирования без webhook
 * Работает только в development (NODE_ENV !== "production")
 *
 * Response:
 * {
 *   ok: boolean
 *   error?: string
 * }
 */

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { updateUserPlan } from "@/lib/payments";
import { NextRequest, NextResponse } from "next/server";

interface YooKassaPayment {
  id: string;
  status: string;
  metadata: {
    userId: string;
    planId: string;
  };
}

export async function GET(request: NextRequest) {
  try {
    // Проверяем что это development mode
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { ok: false, error: "Not available in production" },
        { status: 404 }
      );
    }

    // Получаем paymentId из параметров
    const paymentId = request.nextUrl.searchParams.get("paymentId");
    if (!paymentId) {
      return NextResponse.json(
        { ok: false, error: "paymentId обязателен" },
        { status: 400 }
      );
    }

    // Проверяем аутентификацию
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
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

    // Проверяем статус платежа
    if (paymentData.status !== "succeeded") {
      console.log(
        `[YooKassa Confirm] Payment status is ${paymentData.status}, not succeeded`
      );
      return NextResponse.json({
        ok: false,
        error: `Платёж не оплачен (статус: ${paymentData.status})`,
      });
    }

    // Проверяем userId в metadata
    if (paymentData.metadata?.userId !== session.user.id) {
      console.warn(
        `[YooKassa Confirm] UserID mismatch: payment has ${paymentData.metadata?.userId}, session has ${session.user.id}`
      );
      return NextResponse.json(
        { ok: false, error: "Платёж не принадлежит текущему пользователю" },
        { status: 403 }
      );
    }

    // Получаем planId из metadata
    const planId = paymentData.metadata?.planId;
    if (!planId || !["basic", "professional", "enterprise"].includes(planId)) {
      console.error(
        `[YooKassa Confirm] Invalid planId in metadata: ${planId}`
      );
      return NextResponse.json(
        { ok: false, error: "Невалидный тариф в платеже" },
        { status: 400 }
      );
    }

    // Обновляем план пользователя в БД
    try {
      const now = Math.floor(Date.now() / 1000);
      const thirtyDaysInSeconds = 30 * 24 * 60 * 60;
      const expiresAt = now + thirtyDaysInSeconds;

      await updateUserPlan({
        userId: session.user.id,
        plan: planId as "basic" | "professional" | "enterprise",
        expiresAt,
        paymentProvider: "yookassa",
      });

      console.log(
        `[YooKassa Confirm] Successfully confirmed payment for user ${session.user.id}, plan ${planId}`
      );

      return NextResponse.json({ ok: true });
    } catch (error) {
      console.error("[YooKassa Confirm] Error updating user plan:", error);
      return NextResponse.json(
        { ok: false, error: "Ошибка при обновлении плана" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[YooKassa Confirm] Unexpected error:", error);
    return NextResponse.json(
      { ok: false, error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
