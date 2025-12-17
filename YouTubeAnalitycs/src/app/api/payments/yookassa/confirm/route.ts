/**
 * Endpoint для проверки статуса платежа
 * GET /api/payments/yookassa/confirm?paymentId=XXX
 *
 * ВНИМАНИЕ: НЕ активирует подписку пользователя!
 * Активация тарифа происходит ТОЛЬКО в webhook.
 * Этот endpoint НЕ трогает БД.
 *
 * Response: { ok: true }
 */

import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const paymentId = request.nextUrl.searchParams.get("paymentId");

    if (!paymentId) {
      return NextResponse.json(
        { ok: false, error: "paymentId обязателен" },
        { status: 400 }
      );
    }

    // Вся логика активации тарифа в webhook.
    // Этот endpoint просто возвращает OK.
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[YooKassa Confirm] Error:", error);
    return NextResponse.json(
      { ok: false, error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
