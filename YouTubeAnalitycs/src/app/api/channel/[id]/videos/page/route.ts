import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createClient } from "@libsql/client";

/**
 * GET /api/channel/[id]/videos/page
 *
 * Загружает TOP-12 видео из channel_videos таблицы.
 * Пагинация не поддерживается — всегда возвращает TOP-12.
 *
 * Ответ:
 * {
 *   ok: true,
 *   videos: VideoData[],
 *   totalVideos: number
 * }
 */

export async function GET(
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

    console.log(`[VideosPage] Запрос TOP-12 видео для competitor ID: ${competitorId}`);

    // Получаем данные конкурента для channelId
    const competitorResult = await client.execute({
      sql: "SELECT channelId FROM competitors WHERE id = ? AND userId = ?",
      args: [competitorId, session.user.id],
    });

    if (competitorResult.rows.length === 0) {
      client.close();
      return NextResponse.json({ error: "Competitor not found" }, { status: 404 });
    }

    const channelId = competitorResult.rows[0].channelId as string;

    // Защита: channelId не должен быть пустым или undefined
    if (!channelId || typeof channelId !== 'string' || channelId.trim() === '') {
      client.close();
      console.error(`[VideosPage] Invalid channelId: ${channelId}`);
      return NextResponse.json({ error: "Invalid channel ID in database" }, { status: 400 });
    }

    console.log(`[VideosPage] Загрузка TOP-12 видео для channelId=${channelId}`);

    // Получаем TOP-12 видео из БД
    const videosResult = await client.execute({
      sql: `SELECT id, channelId, videoId, title, thumbnailUrl, viewCount, publishDate, fetchedAt
            FROM channel_videos
            WHERE channelId = ?
            ORDER BY viewCount DESC
            LIMIT 12`,
      args: [channelId],
    });

    const videos = videosResult.rows.map(row => ({ ...row }));

    // Получаем общее количество видео в БД
    const countResult = await client.execute({
      sql: "SELECT COUNT(*) as count FROM channel_videos WHERE channelId = ?",
      args: [channelId],
    });

    const totalVideos = Number(countResult.rows[0]?.count || 0);

    console.log(`[VideosPage] Загружено ${videos.length} видео (всего в БД: ${totalVideos})`);

    client.close();

    return NextResponse.json({
      ok: true,
      videos,
      totalVideos,
    });
  } catch (error) {
    client.close();
    console.error("[VideosPage] Ошибка:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load videos" },
      { status: 500 }
    );
  }
}
