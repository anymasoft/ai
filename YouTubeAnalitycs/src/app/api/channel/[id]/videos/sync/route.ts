import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createClient } from "@libsql/client";
import { getYoutubeChannelVideos } from "@/lib/scrapecreators";

/**
 * POST /api/channel/[id]/videos/sync
 * Синхронизирует топ видео канала с ScrapeCreators API
 * и сохраняет их в channel_videos для анализа контента
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

    // Проверка аутентификации
    if (!session?.user?.id) {
      client.close();
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const competitorId = parseInt(id, 10);

    if (!Number.isFinite(competitorId) || competitorId <= 0) {
      client.close();
      return NextResponse.json(
        { error: "Invalid competitor ID" },
        { status: 400 }
      );
    }

    console.log(`[VideoSync] Запрос синхронизации видео для competitor ID: ${competitorId}`);

    // Получаем данные канала из БД
    const competitorResult = await client.execute({
      sql: "SELECT * FROM competitors WHERE id = ? AND user_id = ?",
      args: [competitorId, session.user.id],
    });

    // Проверяем что канал существует и принадлежит пользователю
    if (competitorResult.rows.length === 0) {
      client.close();
      return NextResponse.json(
        { error: "Competitor not found or access denied" },
        { status: 404 }
      );
    }

    const competitor = competitorResult.rows[0];

    console.log(`[VideoSync] Канал найден: ${competitor.title} (${competitor.handle})`);

    // Получаем видео из ScrapeCreators с fallback на handle
    let videos;
    try {
      videos = await getYoutubeChannelVideos(
        competitor.channel_id as string,
        competitor.handle as string
      );
    } catch (error) {
      console.error("[VideoSync] Ошибка получения видео из ScrapeCreators:", error);
      client.close();
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to fetch videos from ScrapeCreators" },
        { status: 500 }
      );
    }

    console.log(`[VideoSync] Получено ${videos.length} видео из API`);

    // Сохраняем или обновляем видео в БД
    let inserted = 0;
    let updated = 0;

    for (const video of videos) {
      // Проверяем, существует ли уже такое видео
      const existingResult = await client.execute({
        sql: "SELECT * FROM channel_videos WHERE channel_id = ? AND video_id = ?",
        args: [competitor.channel_id, video.videoId],
      });

      if (existingResult.rows.length > 0) {
        // Обновляем существующее видео
        const existing = existingResult.rows[0];
        await client.execute({
          sql: `UPDATE channel_videos SET
            title = ?,
            thumbnail_url = ?,
            view_count = ?,
            like_count = ?,
            comment_count = ?,
            published_at = ?,
            fetched_at = ?
            WHERE id = ?`,
          args: [
            video.title,
            video.thumbnailUrl,
            video.viewCount,
            video.likeCount,
            video.commentCount,
            video.publishedAt,
            Date.now(),
            existing.id,
          ],
        });
        updated++;
      } else {
        // Вставляем новое видео
        await client.execute({
          sql: `INSERT INTO channel_videos (
            channel_id, video_id, title, thumbnail_url, view_count,
            like_count, comment_count, published_at, fetched_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            competitor.channel_id,
            video.videoId,
            video.title,
            video.thumbnailUrl,
            video.viewCount,
            video.likeCount,
            video.commentCount,
            video.publishedAt,
            Date.now(),
          ],
        });
        inserted++;
      }
    }

    console.log(`[VideoSync] Синхронизация завершена: ${inserted} добавлено, ${updated} обновлено`);

    // Подсчитываем общее количество видео для этого канала
    const totalVideosResult = await client.execute({
      sql: "SELECT * FROM channel_videos WHERE channel_id = ?",
      args: [competitor.channel_id],
    });

    client.close();

    return NextResponse.json(
      {
        status: "ok",
        added: inserted,
        updated: updated,
        totalVideos: totalVideosResult.rows.length,
      },
      { status: 200 }
    );
  } catch (error) {
    client.close();
    console.error("[VideoSync] Ошибка при синхронизации видео:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to sync channel videos" },
      { status: 500 }
    );
  }
}
