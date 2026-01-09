import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createClient } from "@libsql/client";

/**
 * POST /api/channel/[id]/audience/show
 *
 * Отмечает в user_channel_audience_state, что пользователь выполнил
 * действие "получить аудиторию" для этого канала.
 */

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const dbPath = process.env.DATABASE_URL || "file:sqlite.db";
  const client = createClient({
    url: dbPath.startsWith("file:") ? dbPath : `file:${dbPath}`,
  });

  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      client.close();
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const competitorId = parseInt(id, 10);

    if (!Number.isFinite(competitorId) || competitorId <= 0) {
      client.close();
      return NextResponse.json({ error: "Invalid competitor ID" }, { status: 400 });
    }

    console.log(`[ShowAudience] Начало показа аудитории, competitor ID: ${competitorId}`);

    // Получаем канал из БД чтобы получить channelId
    const competitorResult = await client.execute({
      sql: "SELECT channelId FROM competitors WHERE id = ? AND userId = ?",
      args: [competitorId, session.user.id],
    });

    if (competitorResult.rows.length === 0) {
      client.close();
      return NextResponse.json({ error: "Competitor not found" }, { status: 404 });
    }

    const channelId = competitorResult.rows[0].channelId as string;

    // Обновляем состояние пользователя: отмечаем, что он показал аудиторию этого канала
    try {
      const now = Date.now();
      await client.execute({
        sql: `INSERT INTO user_channel_audience_state (userId, channelId, hasShownAudience, lastShownAt)
              VALUES (?, ?, 1, ?)
              ON CONFLICT(userId, channelId) DO UPDATE SET hasShownAudience = 1, lastShownAt = ?`,
        args: [session.user.id, channelId, now, now],
      });
      console.log(`[ShowAudience] Обновлено состояние пользователя: hasShownAudience = 1, lastShownAt = ${new Date(now).toISOString()} для channelId=${channelId}`);
    } catch (stateError) {
      console.error(`[ShowAudience] Ошибка при обновлении состояния пользователя:`, stateError instanceof Error ? stateError.message : stateError);
      client.close();
      return NextResponse.json({ error: "Failed to update channel state" }, { status: 500 });
    }

    client.close();

    return NextResponse.json({
      ok: true,
      message: "Audience shown successfully",
    });
  } catch (error) {
    client.close();
    console.error("[ShowAudience] Ошибка:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to show audience" },
      { status: 500 }
    );
  }
}
