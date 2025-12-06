import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import type { ScriptsListResponse, SavedScript } from "@/types/scripts";

/**
 * GET /api/scripts
 * Возвращает список всех сценариев текущего пользователя
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

    // Получаем сценарии пользователя из БД
    const result = await db.execute({
      sql: `
        SELECT
          id, userId, title, hook, outline, scriptText, whyItShouldWork,
          sourceVideos, createdAt
        FROM generated_scripts
        WHERE userId = ?
        ORDER BY createdAt DESC
      `,
      args: [userId],
    });

    const scripts: SavedScript[] = result.rows.map(row => ({
      id: row.id as string,
      userId: row.userId as string,
      title: row.title as string,
      hook: row.hook as string,
      outline: JSON.parse(row.outline as string),
      scriptText: row.scriptText as string,
      whyItShouldWork: row.whyItShouldWork as string,
      sourceVideos: JSON.parse(row.sourceVideos as string),
      createdAt: row.createdAt as number,
    }));

    const response: ScriptsListResponse = {
      scripts,
    };

    console.log(`[ScriptsList] Returning ${scripts.length} scripts for user ${userId}`);

    return NextResponse.json(response);
  } catch (error) {
    console.error("[ScriptsList] Error fetching scripts:", error);

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
        error: "Failed to fetch scripts"
      },
      { status: 500 }
    );
  }
}
