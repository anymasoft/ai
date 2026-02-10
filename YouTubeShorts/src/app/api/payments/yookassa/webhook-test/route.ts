/**
 * ТЕСТОВЫЙ endpoint для перехвата webhook от YooKassa
 * ТОЛЬКО ДЛЯ ДЕБАГА - помогает понять, отправляет ли YooKassa webhook вообще
 */

import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));

  console.log("=" * 80);
  console.log("[WEBHOOK-TEST] 🎯 WEBHOOK ПЕРЕХВАЧЕН!");
  console.log("[WEBHOOK-TEST] Время:", new Date().toISOString());
  console.log("[WEBHOOK-TEST] Метод:", request.method);
  console.log("[WEBHOOK-TEST] URL:", request.url);
  console.log("[WEBHOOK-TEST] Headers:", Object.fromEntries(request.headers));
  console.log("[WEBHOOK-TEST] Body:", JSON.stringify(body, null, 2));
  console.log("=" * 80);

  return NextResponse.json({ success: true, received: true });
}

export async function GET(request: NextRequest) {
  console.log("[WEBHOOK-TEST] GET запрос получен");
  return NextResponse.json({
    status: "webhook-test endpoint active",
    timestamp: new Date().toISOString(),
  });
}
