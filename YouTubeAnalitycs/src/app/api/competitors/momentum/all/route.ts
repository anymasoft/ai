import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTopMomentumVideos } from "@/lib/momentum-queries";

/**
 * GET /api/competitors/momentum/all
 * Возвращает топ видео по momentum score для всех конкурентов пользователя
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    // TEMP: для тестирования используем фиктивный userId
    const userId = session?.user?.id || "test-user-id";

    console.log(`[MomentumAll] Fetching momentum videos for user: ${userId}`);

    // Получаем параметры запроса
    const url = new URL(req.url);
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10), 1), 100) : 50;

    // Получаем топ видео по momentum
    const result = await getTopMomentumVideos(userId, limit);

    console.log(`[MomentumAll] Found ${result.total} videos, returning ${result.items.length} top momentum videos`);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("[MomentumAll] Error fetching momentum videos:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          stack: process.env.NODE_ENV === "development" ? error.stack : undefined
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch momentum videos"
      },
      { status: 500 }
    );
  }
}
