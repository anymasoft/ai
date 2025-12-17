/**
 * Endpoint для подтверждения платежа через YooKassa API
 * GET /api/payments/yookassa/confirm?paymentId=XXX
 *
 * Проверяет статус платежа и активирует подписку пользователя
 * Работает на любом окружении (dev/prod) — режим определяется ключами в .env
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
    billingCycle?: string;
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
        status: paymentData.status,
        metadata: paymentData.metadata
      })
    );

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

    // Получаем planId и billingCycle из metadata
    const planId = paymentData.metadata?.planId;
    const billingCycle = paymentData.metadata?.billingCycle || 'monthly';
    console.log(`[YooKassa Confirm] Extracted planId: ${planId}, billingCycle: ${billingCycle}`);

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
      const now = Date.now();

      // Вычисляем срок подписки в зависимости от billingCycle
      let subscriptionDaysInMs: number;
      if (billingCycle === 'yearly') {
        subscriptionDaysInMs = 365 * 24 * 60 * 60 * 1000;
      } else {
        subscriptionDaysInMs = 30 * 24 * 60 * 60 * 1000;
      }
      const expiresAt = now + subscriptionDaysInMs;

      console.log(
        `[YooKassa Confirm] Updating plan for user ${session.user.id} to ${planId}, expires at ${expiresAt}`
      );

      // ОДИН вызов updateUserPlan с явным expiresAt
      await updateUserPlan({
        userId: session.user.id,
        plan: planId as "basic" | "professional" | "enterprise",
        expiresAt,
        paymentProvider: "yookassa",
      });

      // Логируем платеж в таблицу истории платежей (только логирование, без сайд-эффектов)
      const { PLAN_LIMITS } = await import("@/config/plan-limits");
      const planPrice = PLAN_LIMITS[planId as "basic" | "professional" | "enterprise"]?.price || "0 ₽";

      const { db } = await import("@/lib/db");
      await db.execute(
        `INSERT INTO payments (userId, plan, amount, provider, status, expiresAt, createdAt)
         VALUES (?, ?, ?, 'yookassa', 'succeeded', ?, ?)`,
        [session.user.id, planId, planPrice, expiresAt, now]
      );

      console.log(
        `[YooKassa Confirm] Successfully confirmed payment for user ${session.user.id}, plan ${planId}`
      );

      return NextResponse.json({ ok: true });
    } catch (error) {
      console.error("[YooKassa Confirm] Error updating user plan:", error);
      console.error("[YooKassa Confirm] Error details:", JSON.stringify(error));
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
