import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createClient } from "@libsql/client";

/**
 * POST /api/channel/[id]/videos/show
 *
 * Отмечает в user_channel_state, что пользователь выполнил
 * действие "показать топ-видео" для этого канала.
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

    console.log(`[ShowVideos] Начало показа видео, competitor ID: ${competitorId}`);

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

    // Обновляем состояние пользователя: отмечаем, что он показал видео этого канала
    try {
      // ИСПРАВЛЕНИЕ: записываем lastShownAt как ISO-строку (а не миллисекунды)
      const lastShownAtIso = new Date().toISOString();
      await client.execute({
        sql: `INSERT INTO user_channel_state (userId, channelId, hasShownVideos, lastShownAt)
              VALUES (?, ?, 1, ?)
              ON CONFLICT(userId, channelId) DO UPDATE SET hasShownVideos = 1, lastShownAt = ?`,
        args: [session.user.id, channelId, lastShownAtIso, lastShownAtIso],
      });
      console.log(`[ShowVideos] Обновлено состояние пользователя: hasShownVideos = 1, lastShownAt = ${lastShownAtIso} для channelId=${channelId}`);
    } catch (stateError) {
      console.error(`[ShowVideos] Ошибка при обновлении состояния пользователя:`, stateError instanceof Error ? stateError.message : stateError);
      client.close();
      return NextResponse.json({ error: "Failed to update channel state" }, { status: 500 });
    }

    // Гарантируем полный flush WAL перед ответом клиенту
    // Это критично для SSR: когда page.tsx вызовет router.refresh(), данные должны быть физически записаны в БД
    try {
      await client.execute(`PRAGMA wal_checkpoint(FULL);`);
      console.log("[ShowVideos] WAL checkpoint завершён успешно");
    } catch (walError) {
      console.warn("[ShowVideos] Ошибка при WAL checkpoint (не критично):", walError instanceof Error ? walError.message : walError);
    }

    client.close();

    return NextResponse.json({
      ok: true,
      message: "Videos shown successfully",
    });
  } catch (error) {
    client.close();
    console.error("[ShowVideos] Ошибка:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to show videos" },
      { status: 500 }
    );
  }
}
