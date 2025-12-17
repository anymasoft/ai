/**
 * Check Payment Status Endpoint
 * GET /api/payments/yookassa/check?paymentId=XXX
 *
 * FALLBACK для localhost (когда webhook недоступен)
 * PROD: webhook достаточно
 * LOCAL: UI вызывает этот endpoint после возврата из YooKassa
 *
 * ЛОГИКА:
 * 1. Проверяет payments.status в БД
 * 2. ЕСЛИ уже succeeded → успех
 * 3. ЕСЛИ pending → запрашивает YooKassa API
 * 4. ЕСЛИ YooKassa говорит succeeded → применяет платёж
 * 5. ЕСЛИ нет → возвращает pending
 */

import { NextRequest, NextResponse } from "next/server";
import { applySuccessfulPayment } from "@/lib/payments";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

interface YooKassaPaymentResponse {
  id: string;
  status: string;
  paid: boolean;
}

export async function GET(request: NextRequest) {
  try {
    // Проверяем аутентификацию
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Требуется аутентификация" },
        { status: 401 }
      );
    }

    // Получаем paymentId из query параметров
    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get("paymentId");

    if (!paymentId) {
      return NextResponse.json(
        { error: "paymentId is required" },
        { status: 400 }
      );
    }

    console.log(`[CHECK] Checking payment status: ${paymentId}`);

    // ШАГ 1: Проверяем статус в БД
    const { db } = await import("@/lib/db");
    const dbResult = await db.execute(
      "SELECT status, userId FROM payments WHERE externalPaymentId = ?",
      [paymentId]
    );
    const dbRows = Array.isArray(dbResult) ? dbResult : dbResult.rows || [];

    if (dbRows.length === 0) {
      console.error(`[CHECK] Payment not found in DB: ${paymentId}`);
      return NextResponse.json(
        { success: false, error: "Payment not found" },
        { status: 404 }
      );
    }

    const { status: dbStatus, userId } = dbRows[0];

    // Проверяем что платёж принадлежит текущему user
    if (userId !== session.user.id) {
      console.error(
        `[CHECK] User mismatch: payment.userId=${userId}, session.userId=${session.user.id}`
      );
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    console.log(
      `[CHECK] Found payment in DB: status=${dbStatus}, userId=${userId}`
    );

    // ШАГ 2: ЕСЛИ уже succeeded в БД → готово
    if (dbStatus === "succeeded") {
      console.log(`[CHECK] Payment already succeeded in DB`);
      return NextResponse.json({ success: true, status: "succeeded" });
    }

    // ШАГ 3: ЕСЛИ не pending → ошибка
    if (dbStatus !== "pending") {
      console.log(`[CHECK] Payment has status: ${dbStatus}`);
      return NextResponse.json({
        success: false,
        status: dbStatus,
        error: `Payment status is ${dbStatus}`,
      });
    }

    // ШАГ 4: PULL из YooKassa API (только если pending)
    console.log(`[CHECK] Payment is pending, checking YooKassa API...`);

    const yooKassaShopId = process.env.YOOKASSA_SHOP_ID;
    const yooKassaApiKey = process.env.YOOKASSA_API_KEY;

    if (!yooKassaShopId || !yooKassaApiKey) {
      console.error("[CHECK] YooKassa credentials missing");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const auth = Buffer.from(`${yooKassaShopId}:${yooKassaApiKey}`).toString(
      "base64"
    );

    const yooKassaUrl = `https://api.yookassa.ru/v3/payments/${paymentId}`;
    const response = await fetch(yooKassaUrl, {
      method: "GET",
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error(`[CHECK] YooKassa API error:`, error);
      return NextResponse.json({
        success: false,
        status: "pending",
        error: "Could not verify payment with YooKassa",
      });
    }

    const yooKassaPayment = (await response.json()) as YooKassaPaymentResponse;

    console.log(
      `[CHECK] YooKassa response: status=${yooKassaPayment.status}, paid=${yooKassaPayment.paid}`
    );

    // ШАГ 5: ЕСЛИ YooKassa говорит succeeded → применяем платёж
    if (
      yooKassaPayment.status === "succeeded" &&
      yooKassaPayment.paid === true
    ) {
      console.log(`[CHECK] YooKassa confirmed succeeded, applying payment...`);

      // Используем ту же функцию, что и webhook
      const applyResult = await applySuccessfulPayment(paymentId);

      if (applyResult.success) {
        return NextResponse.json({ success: true, status: "succeeded" });
      } else {
        return NextResponse.json({
          success: false,
          status: "error",
          error: applyResult.reason,
        });
      }
    }

    // ШАГ 6: ЕСЛИ ещё pending → возвращаем pending
    console.log(
      `[CHECK] Payment still pending in YooKassa: ${yooKassaPayment.status}`
    );
    return NextResponse.json({
      success: false,
      status: "pending",
      message: "Payment is still processing",
    });
  } catch (error) {
    console.error("[CHECK] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
