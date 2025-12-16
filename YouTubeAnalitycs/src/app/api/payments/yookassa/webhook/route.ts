/**
 * Webhook обработчик для ЮKassa
 * POST /api/payments/yookassa/webhook
 *
 * Получает уведомление о платеже от ЮKassa и обновляет план пользователя в БД
 */

import { NextRequest, NextResponse } from "next/server";
import { updateUserPlan } from "@/lib/payments";
import crypto from "crypto";

interface YooKassaWebhookEvent {
  type: string;
  event: string;
  data: {
    object: {
      id: string;
      status: string;
      amount: {
        value: string;
        currency: string;
      };
      metadata: {
        userId: string;
        planId: string;
      };
    };
  };
}

/**
 * Распаршивает заголовок HTTP Digest Authentication
 */
function parseDigestAuth(authHeader: string): Record<string, string> | null {
  const digestMatch = authHeader.match(/Digest\s+(.+)/i);
  if (!digestMatch) return null;

  const params: Record<string, string> = {};
  const paramStr = digestMatch[1];
  const paramRegex = /(\w+)=(?:"([^"]*)"|([^\s,]*))/g;
  let match;

  while ((match = paramRegex.exec(paramStr)) !== null) {
    params[match[1]] = match[2] || match[3];
  }

  return params;
}

/**
 * Проверяет подпись webhook от ЮKassa через HTTP Digest Authentication
 * Алгоритм:
 * 1. Вычисляем HA1 = MD5(username:realm:password)
 * 2. Вычисляем HA2 = MD5(method:uri)
 * 3. Вычисляем response = MD5(HA1:nonce:HA2)
 * 4. Сравниваем с полученной подписью
 */
function verifyYooKassaWebhook(
  body: string,
  authHeader: string | null,
  method: string,
  uri: string
): boolean {
  const yooKassaShopId = process.env.YOOKASSA_SHOP_ID;
  const yooKassaSecretKey = process.env.YOOKASSA_SECRET_KEY;

  if (!yooKassaShopId || !yooKassaSecretKey || !authHeader) {
    console.error("[YooKassa Webhook] Missing credentials or auth header");
    return false;
  }

  try {
    // Парсим заголовок Digest Authentication
    const digestParams = parseDigestAuth(authHeader);
    if (!digestParams) {
      console.error("[YooKassa Webhook] Invalid Digest format");
      return false;
    }

    const { username, realm, nonce, response: clientResponse, algorithm } = digestParams;

    // Проверяем, что это правильный username
    if (username !== yooKassaShopId) {
      console.warn(`[YooKassa Webhook] Username mismatch: expected ${yooKassaShopId}, got ${username}`);
      return false;
    }

    // Используем алгоритм MD5 (стандартный для ЮKassa)
    const algo = algorithm?.toUpperCase() || "MD5";
    if (algo !== "MD5") {
      console.warn(`[YooKassa Webhook] Unsupported algorithm: ${algo}`);
      return false;
    }

    // Вычисляем HA1 = MD5(username:realm:password)
    const ha1 = crypto
      .createHash("md5")
      .update(`${username}:${realm}:${yooKassaSecretKey}`)
      .digest("hex");

    // Вычисляем HA2 = MD5(method:uri)
    const ha2 = crypto
      .createHash("md5")
      .update(`${method}:${uri}`)
      .digest("hex");

    // Вычисляем ожидаемый response = MD5(HA1:nonce:HA2)
    const expectedResponse = crypto
      .createHash("md5")
      .update(`${ha1}:${nonce}:${ha2}`)
      .digest("hex");

    // Сравниваем подписи
    if (clientResponse !== expectedResponse) {
      console.warn(
        `[YooKassa Webhook] Signature mismatch: expected ${expectedResponse}, got ${clientResponse}`
      );
      return false;
    }

    console.log("[YooKassa Webhook] Signature verified successfully");
    return true;
  } catch (error) {
    console.error("[YooKassa Webhook] Verification error:", error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Получаем тело запроса
    const body = await request.text();

    // Проверяем подпись через HTTP Digest Authentication
    const authHeader = request.headers.get("authorization");
    const method = request.method;
    const uri = new URL(request.url).pathname;

    if (!verifyYooKassaWebhook(body, authHeader, method, uri)) {
      console.error("[YooKassa Webhook] Invalid signature - rejecting webhook");
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    const event = JSON.parse(body) as YooKassaWebhookEvent;

    // Проверяем тип события - нас интересуют успешные платежи
    if (event.type !== "notification" || event.event !== "payment.succeeded") {
      console.log(`[YooKassa Webhook] Skipping event type: ${event.type}`);
      return NextResponse.json({ success: true });
    }

    const paymentData = event.data.object;
    const { userId, planId } = paymentData.metadata;

    // Проверяем статус платежа
    if (paymentData.status !== "succeeded") {
      console.log(
        `[YooKassa Webhook] Payment status is ${paymentData.status}, skipping`
      );
      return NextResponse.json({ success: true });
    }

    // Валидируем planId
    if (!["basic", "professional", "enterprise"].includes(planId)) {
      console.error(`[YooKassa Webhook] Invalid planId: ${planId}`);
      return NextResponse.json({ success: true });
    }

    // Вычисляем дату истечения подписки (текущая дата + 30 дней)
    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysInSeconds = 30 * 24 * 60 * 60;
    const expiresAt = now + thirtyDaysInSeconds;

    // Обновляем план пользователя в БД
    await updateUserPlan({
      userId,
      plan: planId as "basic" | "professional" | "enterprise",
      expiresAt,
      paymentProvider: "yookassa",
    });

    // Логируем платеж в таблицу истории платежей
    const { PLAN_LIMITS } = await import("@/config/plan-limits");
    const planPrice = PLAN_LIMITS[planId as "basic" | "professional" | "enterprise"]?.price || "0 ₽";

    const { db } = await import("@/lib/db");
    await db.execute(
      `INSERT INTO payments (userId, plan, amount, provider, status, expiresAt, createdAt)
       VALUES (?, ?, ?, 'yookassa', 'succeeded', ?, ?)`,
      [userId, planId, planPrice, expiresAt, now]
    );

    console.log(
      `[YooKassa Webhook] Successfully processed payment for user ${userId}, plan ${planId}`
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[YooKassa Webhook] Error processing webhook:", error);
    // Возвращаем 200 OK, чтобы ЮKassa не пытался переотправить
    return NextResponse.json({ success: true });
  }
}
