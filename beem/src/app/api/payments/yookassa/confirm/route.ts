/**
 * DEPRECATED: Confirm endpoint больше не меняет тариф
 * Webhook - единственный активатор тарифа
 *
 * Этот endpoint остаётся ТОЛЬКО для совместимости
 */

import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  // Webhook - единственная точка активации
  // Этот endpoint ничего не делает
  return NextResponse.json({ ok: true });
}
