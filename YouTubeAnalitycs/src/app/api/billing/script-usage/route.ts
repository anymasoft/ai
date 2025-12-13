import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getBillingScriptUsageInfo } from "@/lib/script-usage";
import type { PlanType } from "@/config/plan-limits";

/**
 * Отключаем кэширование для этого API endpoint
 * Нужно всегда возвращать свежие данные об использовании сценариев
 */
export const dynamic = "force-dynamic";

/**
 * GET /api/billing/script-usage
 * Возвращает информацию об использовании сценариев для страницы биллинга
 */
export async function GET(req: NextRequest) {
  try {
    // Проверка аутентификации
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const plan = (session.user.plan || "free") as PlanType;
    console.log("[BILLING] userId =", userId, "type:", typeof userId, "plan =", plan);

    // Получаем информацию об использовании
    const usageInfo = await getBillingScriptUsageInfo(userId, plan);
    console.log("[BILLING] usageInfo =", JSON.stringify(usageInfo));

    return NextResponse.json(usageInfo, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    });
  } catch (error) {
    console.error("[BillingScriptUsage] Error:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        {
          error: error.message,
          stack: process.env.NODE_ENV === "development" ? error.stack : undefined
        },
        {
          status: 500,
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          },
        }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to fetch script usage"
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    );
  }
}
