import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createClient } from "@libsql/client";
import { getYoutubeChannelVideos, getYoutubeVideoDetails } from "@/lib/scrapecreators";
import { getVideoLimitForPlan } from "@/config/limits";
import { getUserPlan } from "@/lib/user-plan";

/**
 * POST /api/channel/[id]/videos/sync
 *
 * Простая синхронизация видео:
 * 1. Получаем список видео из /v1/youtube/channel-videos
 * 2. Для каждого видео получаем publishDate из /v1/youtube/video
 * 3. Сохраняем в БД как есть
 *
 * Единственное поле даты: publishDate (ISO 8601 строка)
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

    console.log(`[VideoSync] Начало синхронизации, competitor ID: ${competitorId}`);

    // Получаем канал из БД
    const competitorResult = await client.execute({
      sql: "SELECT * FROM competitors WHERE id = ? AND userId = ?",
      args: [competitorId, session.user.id],
    });

    if (competitorResult.rows.length === 0) {
      client.close();
      return NextResponse.json({ error: "Competitor not found" }, { status: 404 });
    }

    const competitor = competitorResult.rows[0];
    console.log(`[VideoSync] Канал: ${competitor.title}`);

    // Получаем список видео из API
    let videos;
    try {
      videos = await getYoutubeChannelVideos(
        competitor.channelId as string,
        competitor.handle as string
      );
    } catch (error) {
      console.error("[VideoSync] Ошибка получения списка видео:", error);
      client.close();
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to fetch videos" },
        { status: 500 }
      );
    }

    console.log(`[VideoSync] Получено ${videos.length} видео из API`);

    // Лимиты по тарифу
    const userPlan = getUserPlan(session);
    const maxVideos = getVideoLimitForPlan(userPlan);
    const limitedVideos = videos.slice(0, maxVideos);

    console.log(`[VideoSync] Обрабатываем ${limitedVideos.length} видео (лимит: ${maxVideos})`);

    // Получаем publishDate для каждого видео
    for (const video of limitedVideos) {
      if (!video.videoId) continue;

      try {
        const videoUrl = `https://www.youtube.com/watch?v=${video.videoId}`;
        const details = await getYoutubeVideoDetails(videoUrl);

        // Простое присвоение: что вернул API — то и сохраняем
        video.publishDate = details.publishDate || null;

        console.log(`[VideoSync] ${video.videoId}: publishDate = ${video.publishDate}`);
      } catch (err) {
        console.warn(`[VideoSync] Ошибка для ${video.videoId}:`, err instanceof Error ? err.message : err);
        video.publishDate = null;
      }

      // Задержка между запросами
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Сохраняем в БД
    let inserted = 0;
    let updated = 0;

    for (const video of limitedVideos) {
      const existingResult = await client.execute({
        sql: "SELECT id FROM channel_videos WHERE channelId = ? AND videoId = ?",
        args: [competitor.channelId, video.videoId],
      });

      if (existingResult.rows.length > 0) {
        // UPDATE
        await client.execute({
          sql: `UPDATE channel_videos SET
            title = ?,
            thumbnailUrl = ?,
            viewCount = ?,
            likeCount = ?,
            commentCount = ?,
            publishDate = ?,
            duration = ?,
            fetchedAt = ?
            WHERE id = ?`,
          args: [
            video.title,
            video.thumbnailUrl,
            video.viewCount,
            video.likeCount,
            video.commentCount,
            video.publishDate,
            video.duration || null,
            Date.now(),
            existingResult.rows[0].id,
          ],
        });
        updated++;
      } else {
        // INSERT
        await client.execute({
          sql: `INSERT INTO channel_videos (
            channelId, videoId, title, thumbnailUrl, viewCount,
            likeCount, commentCount, publishDate, duration, fetchedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            competitor.channelId,
            video.videoId,
            video.title,
            video.thumbnailUrl,
            video.viewCount,
            video.likeCount,
            video.commentCount,
            video.publishDate,
            video.duration || null,
            Date.now(),
          ],
        });
        inserted++;
      }
    }

    // Общее количество видео
    const totalResult = await client.execute({
      sql: "SELECT COUNT(*) as count FROM channel_videos WHERE channelId = ?",
      args: [competitor.channelId],
    });

    const totalVideos = Number(totalResult.rows[0]?.count || 0);

    console.log(`[VideoSync] Готово: добавлено ${inserted}, обновлено ${updated}, всего ${totalVideos}`);

    client.close();

    return NextResponse.json({
      status: "ok",
      added: inserted,
      updated: updated,
      totalVideos,
      plan: userPlan,
      videoLimit: maxVideos,
    });
  } catch (error) {
    client.close();
    console.error("[VideoSync] Ошибка:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}
