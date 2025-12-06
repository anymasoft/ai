import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createClient } from "@libsql/client";

/**
 * GET /api/channel/[id]/comments/ai/progress
 * Возвращает прогресс выполнения глубокого AI-анализа комментариев
 * НИКОГДА не падает, всегда возвращает JSON с полями по умолчанию.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      // Возвращаем структуру прогресса с ошибкой, но HTTP 401
      return NextResponse.json(
        {
          status: "error",
          progress_current: 0,
          progress_total: 1,
          percent: 0,
        },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const competitorId = parseInt(id, 10);

    if (!Number.isFinite(competitorId) || competitorId <= 0) {
      return NextResponse.json(
        {
          status: "error",
          progress_current: 0,
          progress_total: 1,
          percent: 0,
        },
        { status: 400 }
      );
    }

    // Подключаемся к БД
    const dbPath = process.env.DATABASE_URL || "file:sqlite.db";
    const client = createClient({
      url: dbPath.startsWith("file:") ? dbPath : `file:${dbPath}`,
    });

    // Получаем channelId конкурента
    const competitorResult = await client.execute({
      sql: `SELECT channelId FROM competitors WHERE id = ? AND userId = ?`,
      args: [competitorId, session.user.id],
    });

    if (competitorResult.rows.length === 0) {
      client.close();
      return NextResponse.json(
        {
          status: "error",
          progress_current: 0,
          progress_total: 1,
          percent: 0,
        },
        { status: 404 }
      );
    }

    const channelId = competitorResult.rows[0].channelId as string;

    // Получаем последний анализ с прогрессом
    const progressResult = await client.execute({
      sql: `SELECT progress_current, progress_total, status
            FROM channel_ai_comment_insights
            WHERE channelId = ?
            ORDER BY createdAt DESC
            LIMIT 1`,
      args: [channelId],
    });

    client.close();

    if (progressResult.rows.length === 0) {
      return NextResponse.json(
        {
          status: "pending",
          progress_current: 0,
          progress_total: 1,
          percent: 0,
        },
        { status: 200 }
      );
    }

    const row = progressResult.rows[0];
    const status = (row.status as string) ?? "pending";
    const progress_current = (row.progress_current as number) ?? 0;
    const progress_total = (row.progress_total as number) ?? 1;
    const percent =
      progress_total > 0
        ? Math.round((progress_current / progress_total) * 100)
        : 0;

    return NextResponse.json(
      {
        status,
        progress_current,
        progress_total,
        percent,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[progress error]", error);
    // Всегда возвращаем JSON, даже при неизвестной ошибке
    return NextResponse.json(
      {
        status: "error",
        progress_current: 0,
        progress_total: 1,
        percent: 0,
      },
      { status: 500 }
    );
  }
}
