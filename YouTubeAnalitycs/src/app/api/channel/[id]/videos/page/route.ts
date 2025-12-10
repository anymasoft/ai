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

    // Защита: id должен быть непустой строкой (это channelId, а не competitorId)
    if (!id || typeof id !== 'string' || id.trim() === '' || id === 'undefined') {
      client.close();
      return NextResponse.json({ error: "channelId is missing or invalid" }, { status: 400 });
    }

    const channelId = id;
    console.log(`[VideosPage] Запрос TOP-12 видео для channelId=${channelId}`);

    // Проверяем что этот channelId принадлежит текущему пользователю
    console.log(`[DB] SELECT competitors: args=[${channelId}, ${session.user.id}]`);
    const competitorResult = await client.execute({
      sql: "SELECT id FROM competitors WHERE channelId = ? AND userId = ?",
      args: [channelId, session.user.id],
    });

    if (competitorResult.rows.length === 0) {
      client.close();
      return NextResponse.json({ error: "Channel not found or not authorized" }, { status: 404 });
    }

    console.log(`[VideosPage] Загрузка TOP-12 видео для channelId=${channelId}`);

    // Получаем TOP-12 видео из БД
    console.log(`[DB] SELECT videos: args=[${channelId}]`);
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
    console.log(`[DB] COUNT videos: args=[${channelId}]`);
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
