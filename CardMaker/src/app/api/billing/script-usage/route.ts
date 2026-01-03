import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getBillingScriptUsageInfo } from "@/lib/script-usage";

/**
 * Отключаем кэширование для этого API endpoint
 * Нужно всегда возвращать свежие данные о балансе описаний
 */
export const dynamic = "force-dynamic";

/**
 * GET /api/billing/script-usage
 * Возвращает информацию о балансе описаний пользователя
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

    // Получаем информацию о балансе
    const usageInfo = await getBillingScriptUsageInfo(userId);

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
