import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createClient } from "@libsql/client";
import { getYoutubeChannelVideos, getYoutubeVideoDetails } from "@/lib/scrapecreators";
import { getVideoLimitForPlan } from "@/config/limits";
import { getUserPlan } from "@/lib/user-plan";

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

    // === ЛИМИТЫ ПО ТАРИФУ ===
    // Ограничиваем количество видео в зависимости от плана пользователя
    // Это экономит кредиты ScrapeCreators и токены AI
    const userPlan = getUserPlan(session);
    const maxVideos = getVideoLimitForPlan(userPlan);

    console.log(`[VideoSync] План пользователя: ${userPlan}, лимит видео: ${maxVideos}`);

    // Обрезаем массив до лимита тарифа
    // Видео уже отсортированы по дате (latest first) в API
    const limitedVideos = videos.slice(0, maxVideos);

    console.log(`[VideoSync] После лимита: ${limitedVideos.length} видео (было ${videos.length})`);

    // Получаем точные даты для каждого видео через /v1/youtube/video
    // Только для ограниченного набора видео!
    console.log(`[VideoSync] Запрашиваем точные даты публикации для ${limitedVideos.length} видео...`);

    let datesUpdated = 0;
    let datesFailed = 0;

    for (const video of limitedVideos) {
      if (video.videoId) {
        const originalDate = video.publishedAt;

        try {
          const videoUrl = `https://www.youtube.com/watch?v=${video.videoId}`;
          const details = await getYoutubeVideoDetails(videoUrl);

          console.log(`[VideoSync] Детали для ${video.videoId}:`, {
            originalDate,
            apiPublishedAt: details.publishedAt,
            hasPublishedAt: !!details.publishedAt,
          });

          if (details.publishedAt) {
            // Валидация: дата должна быть в формате YYYY-MM-DD и не в будущем
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            const parsedDate = new Date(details.publishedAt);
            const isValidFormat = dateRegex.test(details.publishedAt);
            const isValidDate = !isNaN(parsedDate.getTime());
            const isNotFuture = parsedDate <= new Date();

            if (isValidFormat && isValidDate && isNotFuture) {
              video.publishedAt = details.publishedAt;
              datesUpdated++;
              console.log(`[VideoSync] ✓ Дата обновлена для ${video.videoId}: ${originalDate} → ${details.publishedAt}`);
            } else {
              console.warn(`[VideoSync] ✗ Невалидная дата для ${video.videoId}:`, {
                publishedAt: details.publishedAt,
                isValidFormat,
                isValidDate,
                isNotFuture,
              });
              datesFailed++;
            }
          } else {
            console.warn(`[VideoSync] ✗ API не вернул publishedAt для ${video.videoId}`);
            datesFailed++;
          }
        } catch (err) {
          console.warn(`[VideoSync] ✗ Ошибка получения даты для ${video.videoId}:`, err);
          datesFailed++;
        }
      }
    }

    console.log(`[VideoSync] Итого дат: обновлено ${datesUpdated}, ошибок ${datesFailed}`)

    // Сохраняем или обновляем видео в БД
    // Используем limitedVideos — только видео в рамках лимита тарифа
    let inserted = 0;
    let updated = 0;

    for (const video of limitedVideos) {
      // Проверяем, существует ли уже такое видео
      const existingResult = await client.execute({
        sql: "SELECT * FROM channel_videos WHERE channelId = ? AND videoId = ?",
        args: [competitor.channelId, video.videoId],
      });

      if (existingResult.rows.length > 0) {
        // Обновляем существующее видео
        const existing = existingResult.rows[0];
        const oldDate = existing.publishedAt;

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
            video.publishedAt,
            video.duration || null,
            Date.now(),
            existing.id,
          ],
        });

        if (oldDate !== video.publishedAt) {
          console.log(
            `[VideoSync] Video ${video.videoId} date BEFORE update: ${oldDate}`
          );
          console.log(
            `[VideoSync] Video ${video.videoId} date AFTER update: ${video.publishedAt}`
          );
          console.log(
            `[VideoSync] Source API date: ${video.publishedAt}`
          );
        }

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
            video.publishedAt,
            video.duration || null,
            Date.now(),
          ],
        });

        console.log(
          `[VideoSync] Video ${video.videoId} inserted with date: ${video.publishedAt}`
        );

        inserted++;
      }
    }

    console.log(`[VideoSync] Синхронизация завершена: ${inserted} добавлено, ${updated} обновлено`);

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
        totalVideos: totalVideosResult.rows.length,
        // Информация о лимитах для UI
        plan: userPlan,
        videoLimit: maxVideos,
        videosFromApi: videos.length,
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
