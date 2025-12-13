import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getBillingScriptUsageInfo } from "@/lib/script-usage";
import type { PlanType } from "@/config/plan-limits";

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

    // Получаем информацию об использовании
    const usageInfo = await getBillingScriptUsageInfo(userId, plan);

    return NextResponse.json(usageInfo);
  } catch (error) {
    console.error("[BillingScriptUsage] Error:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        {
          error: error.message,
          stack: process.env.NODE_ENV === "development" ? error.stack : undefined
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to fetch script usage"
      },
      { status: 500 }
    );
  }
}
