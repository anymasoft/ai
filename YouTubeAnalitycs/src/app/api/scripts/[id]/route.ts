import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import type { SavedScript } from "@/types/scripts";

/**
 * GET /api/scripts/[id]
 * Возвращает конкретный сценарий по ID
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Ожидаем параметры (Next.js 15+)
    const { id } = await params;

    // Проверка аутентификации
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const scriptId = id;

    // Получаем сценарий из БД
    const result = await db.execute({
      sql: `
        SELECT
          id, userId, title, hook, outline, scriptText, whyItShouldWork,
          sourceVideos, createdAt
        FROM generated_scripts
        WHERE id = ? AND userId = ?
      `,
      args: [scriptId, userId],
    });

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Script not found or access denied" },
        { status: 404 }
      );
    }

    const row = result.rows[0];
    const script: SavedScript = {
      id: row.id as string,
      userId: row.userId as string,
      title: row.title as string,
      hook: row.hook as string,
      outline: JSON.parse(row.outline as string),
      scriptText: row.scriptText as string,
      whyItShouldWork: row.whyItShouldWork as string,
      sourceVideos: JSON.parse(row.sourceVideos as string),
      createdAt: row.createdAt as number,
    };

    console.log(`[ScriptDetail] Returning script ${scriptId} for user ${userId}`);

    return NextResponse.json(script);
  } catch (error) {
    console.error("[ScriptDetail] Error fetching script:", error);

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
        error: "Failed to fetch script"
      },
      { status: 500 }
    );
  }
}
