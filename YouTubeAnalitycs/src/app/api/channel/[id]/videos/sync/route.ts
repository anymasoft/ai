import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createClient } from "@libsql/client";
import { getYoutubeChannelVideos } from "@/lib/scrapecreators";
import {
  resolveVideoPublishDate,
  getVideoCommentsFromDB,
  getVideoNeighborsFromDB,
} from "@/lib/publish-date-resolver";

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
      sql: "SELECT * FROM competitors WHERE id = ? AND userId = ?",
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
        competitor.channelId as string,
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

    // Сохраняем или обновляем видео в БД с resolver'ом для дат
    let inserted = 0;
    let updated = 0;
    let resolvedDates = 0;

    for (const video of videos) {
      // Сначала проверяем, существует ли уже такое видео
      const existingResult = await client.execute({
        sql: "SELECT * FROM channel_videos WHERE channelId = ? AND videoId = ?",
        args: [competitor.channelId, video.videoId],
      });

      // Резолвим дату публикации (многоступенчатый fallback)
      let resolvedPublishedAt = video.publishedAt;

      // Если дата отсутствует или невалидна - пытаемся восстановить её
      if (!resolvedPublishedAt || resolvedPublishedAt.startsWith("0000")) {
        console.log(
          `[VideoSync] Resolving date for video ${video.videoId} (current: ${resolvedPublishedAt})`
        );

        // Получаем комментарии и соседей (может быть полезно для интерполяции)
        const comments = await getVideoCommentsFromDB(video.videoId);
        const neighbors = await getVideoNeighborsFromDB(
          competitor.channelId as string,
          video.videoId as string
        );

        // Используем резолвер
        const resolved = await resolveVideoPublishDate(
          video.videoId,
          {
            videoId: video.videoId,
            publishedAt: (video.publishedAt as string | null) || null,
            viewCount: video.viewCount,
          },
          comments,
          neighbors
        );

        if (resolved) {
          resolvedPublishedAt = resolved;
          resolvedDates++;
          console.log(
            `[VideoSync] Successfully resolved date for ${video.videoId}: ${resolved}`
          );
        } else {
          // Если не смогли восстановить - используем текущую дату как fallback
          // (это крайний случай, обычно один из резолверов должен сработать)
          resolvedPublishedAt = new Date().toISOString().split("T")[0];
          console.warn(
            `[VideoSync] Could not resolve date for ${video.videoId}, using today's date`
          );
        }
      }

      if (existingResult.rows.length > 0) {
        // Обновляем существующее видео
        const existing = existingResult.rows[0];
        await client.execute({
          sql: `UPDATE channel_videos SET
            title = ?,
            thumbnailUrl = ?,
            viewCount = ?,
            likeCount = ?,
            commentCount = ?,
            publishedAt = ?,
            duration = ?,
            fetchedAt = ?
            WHERE id = ?`,
          args: [
            video.title,
            video.thumbnailUrl,
            video.viewCount,
            video.likeCount,
            video.commentCount,
            resolvedPublishedAt,
            video.duration || null,
            Date.now(),
            existing.id,
          ],
        });
        updated++;
      } else {
        // Вставляем новое видео
        await client.execute({
          sql: `INSERT INTO channel_videos (
            channelId, videoId, title, thumbnailUrl, viewCount,
            likeCount, commentCount, publishedAt, duration, fetchedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            competitor.channelId,
            video.videoId,
            video.title,
            video.thumbnailUrl,
            video.viewCount,
            video.likeCount,
            video.commentCount,
            resolvedPublishedAt,
            video.duration || null,
            Date.now(),
          ],
        });
        inserted++;
      }
    }

    console.log(
      `[VideoSync] Синхронизация завершена: ${inserted} добавлено, ${updated} обновлено, ${resolvedDates} дат восстановлено`
    );

    // Подсчитываем общее количество видео для этого канала
    const totalVideosResult = await client.execute({
      sql: "SELECT * FROM channel_videos WHERE channelId = ?",
      args: [competitor.channelId],
    });

    client.close();

    return NextResponse.json(
      {
        status: "ok",
        added: inserted,
        updated: updated,
        resolvedDates: resolvedDates,
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
