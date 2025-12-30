import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createClient } from "@libsql/client";

/**
 * POST /api/channel/[id]/content/show
 *
 * Отмечает в user_channel_content_state, что пользователь выполнил
 * действие "получить контент-аналитику" для этого канала.
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

    console.log(`[ShowContent] Начало показа контент-аналитики, competitor ID: ${competitorId}`);

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

    // Обновляем состояние пользователя: отмечаем, что он показал контент-аналитику этого канала
    try {
      const now = Date.now();
      await client.execute({
        sql: `INSERT INTO user_channel_content_state (userId, channelId, hasShownContent, lastShownAt)
              VALUES (?, ?, 1, ?)
              ON CONFLICT(userId, channelId) DO UPDATE SET hasShownContent = 1, lastShownAt = ?`,
        args: [session.user.id, channelId, now, now],
      });
      console.log(`[ShowContent] Обновлено состояние пользователя: hasShownContent = 1, lastShownAt = ${new Date(now).toISOString()} для channelId=${channelId}`);
    } catch (stateError) {
      console.error(`[ShowContent] Ошибка при обновлении состояния пользователя:`, stateError instanceof Error ? stateError.message : stateError);
      client.close();
      return NextResponse.json({ error: "Failed to update channel state" }, { status: 500 });
    }

    client.close();

    return NextResponse.json({
      ok: true,
      message: "Content shown successfully",
    });
  } catch (error) {
    client.close();
    console.error("[ShowContent] Ошибка:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to show content" },
      { status: 500 }
    );
  }
}
