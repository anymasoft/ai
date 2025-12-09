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
 *
 * ЕДИНСТВЕННЫЙ ИСТОЧНИК ДАТЫ: publishDate из /v1/youtube/video
 * Формат: полная ISO 8601 строка (например "2025-05-31T08:14:35-07:00")
 *
 * ГАРАНТИИ:
 * - Retry с exponential backoff при ошибках API
 * - Существующая дата НИКОГДА не перезаписывается на null
 * - Детальное логирование каждого этапа
 */

// Маркеры для логов
const LOG_PREFIX = {
  SYNC: "[VideoSync]",
  API: "[API→]",
  DB_READ: "[DB←]",
  DB_WRITE: "[DB→]",
  DATE: "[DATE]",
  ERROR: "[ERROR]",
  RETRY: "[RETRY]",
  SUCCESS: "[✓]",
  FAIL: "[✗]",
};

/**
 * Получает publishDate для видео с retry
 * @returns publishDate или null если не удалось получить после всех попыток
 */
async function fetchPublishDateWithRetry(
  videoId: string,
  maxRetries: number = 3
): Promise<string | null> {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`${LOG_PREFIX.API} ${LOG_PREFIX.RETRY} Попытка ${attempt}/${maxRetries} получить publishDate для ${videoId}`);

      const details = await getYoutubeVideoDetails(videoUrl);

      console.log(`${LOG_PREFIX.API} Ответ для ${videoId}:`, {
        publishDate: details.publishDate,
        viewCount: details.viewCount,
        likeCount: details.likeCount,
      });

      if (details.publishDate) {
        // Валидация: дата должна парситься и не быть в будущем
        const parsedDate = new Date(details.publishDate);
        const isValidDate = !isNaN(parsedDate.getTime());
        const isNotFuture = parsedDate <= new Date();

        if (isValidDate && isNotFuture) {
          console.log(`${LOG_PREFIX.DATE} ${LOG_PREFIX.SUCCESS} ${videoId}: publishDate = ${details.publishDate}`);
          return details.publishDate;
        } else {
          console.warn(`${LOG_PREFIX.DATE} ${LOG_PREFIX.FAIL} ${videoId}: невалидная дата`, {
            publishDate: details.publishDate,
            isValidDate,
            isNotFuture,
            parsedTime: parsedDate.getTime(),
          });
          // Не делаем retry при невалидной дате - API вернул ответ, просто дата плохая
          return null;
        }
      } else {
        console.warn(`${LOG_PREFIX.API} ${LOG_PREFIX.FAIL} ${videoId}: API не вернул publishDate`);
        // API не вернул publishDate - пробуем retry
        lastError = new Error("API не вернул publishDate");
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`${LOG_PREFIX.API} ${LOG_PREFIX.ERROR} ${videoId}: попытка ${attempt} - ${lastError.message}`);

      // Если это rate limit (429) - ждём дольше
      const isRateLimit = lastError.message.includes("rate limit") || lastError.message.includes("429");

      if (attempt < maxRetries) {
        // Exponential backoff: 2s, 4s, 8s (или дольше для rate limit)
        const baseDelay = isRateLimit ? 5000 : 2000;
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`${LOG_PREFIX.RETRY} Ожидание ${delay}ms перед следующей попыткой...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  console.error(`${LOG_PREFIX.DATE} ${LOG_PREFIX.FAIL} ${videoId}: не удалось получить publishDate после ${maxRetries} попыток`, {
    lastError: lastError?.message,
  });

  return null;
}

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

    console.log(`${LOG_PREFIX.SYNC} ========== НАЧАЛО СИНХРОНИЗАЦИИ ==========`);
    console.log(`${LOG_PREFIX.SYNC} Competitor ID: ${competitorId}`);

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

    console.log(`${LOG_PREFIX.SYNC} Канал: ${competitor.title} (${competitor.handle})`);
    console.log(`${LOG_PREFIX.SYNC} Channel ID: ${competitor.channelId}`);

    // Получаем видео из ScrapeCreators с fallback на handle
    let videos;
    try {
      console.log(`${LOG_PREFIX.API} Запрос списка видео канала...`);
      videos = await getYoutubeChannelVideos(
        competitor.channelId as string,
        competitor.handle as string
      );
    } catch (error) {
      console.error(`${LOG_PREFIX.API} ${LOG_PREFIX.ERROR} Ошибка получения видео:`, error);
      client.close();
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to fetch videos from ScrapeCreators" },
        { status: 500 }
      );
    }

    console.log(`${LOG_PREFIX.API} Получено ${videos.length} видео из API channel-videos`);

    // === ЛИМИТЫ ПО ТАРИФУ ===
    const userPlan = getUserPlan(session);
    const maxVideos = getVideoLimitForPlan(userPlan);

    console.log(`${LOG_PREFIX.SYNC} План: ${userPlan}, лимит видео: ${maxVideos}`);

    // Обрезаем массив до лимита тарифа
    const limitedVideos = videos.slice(0, maxVideos);

    console.log(`${LOG_PREFIX.SYNC} После применения лимита: ${limitedVideos.length} видео`);

    // === ПОЛУЧЕНИЕ publishDate ДЛЯ КАЖДОГО ВИДЕО ===
    console.log(`${LOG_PREFIX.DATE} ========== ПОЛУЧЕНИЕ ДАТ ПУБЛИКАЦИИ ==========`);
    console.log(`${LOG_PREFIX.DATE} Запрашиваем publishDate для ${limitedVideos.length} видео...`);

    let datesSuccess = 0;
    let datesFailed = 0;
    let datesSkipped = 0;

    // Проверяем, какие видео уже имеют publishDate в БД
    const existingDates = new Map<string, string | null>();

    for (const video of limitedVideos) {
      if (video.videoId) {
        const existing = await client.execute({
          sql: "SELECT videoId, publishDate FROM channel_videos WHERE channelId = ? AND videoId = ?",
          args: [competitor.channelId, video.videoId],
        });

        if (existing.rows.length > 0) {
          const dbDate = existing.rows[0].publishDate as string | null;
          existingDates.set(video.videoId, dbDate);

          if (dbDate) {
            console.log(`${LOG_PREFIX.DB_READ} ${video.videoId}: уже имеет publishDate = ${dbDate}`);
          }
        }
      }
    }

    // Получаем publishDate для каждого видео
    for (const video of limitedVideos) {
      if (!video.videoId) {
        console.warn(`${LOG_PREFIX.SYNC} ${LOG_PREFIX.FAIL} Видео без videoId пропущено`);
        continue;
      }

      // Если видео уже имеет дату в БД и она валидная - пропускаем запрос к API
      const existingDate = existingDates.get(video.videoId);
      if (existingDate && existingDate.length > 0) {
        // Проверяем что существующая дата валидная
        const parsedExisting = new Date(existingDate);
        if (!isNaN(parsedExisting.getTime())) {
          console.log(`${LOG_PREFIX.DATE} ${video.videoId}: используем существующую дату из БД: ${existingDate}`);
          video.publishDate = existingDate;
          datesSkipped++;
          continue;
        }
      }

      // Запрашиваем дату через API с retry
      const publishDate = await fetchPublishDateWithRetry(video.videoId, 3);

      if (publishDate) {
        video.publishDate = publishDate;
        datesSuccess++;
      } else {
        // ВАЖНО: если не удалось получить дату, сохраняем существующую (если есть)
        if (existingDate) {
          console.log(`${LOG_PREFIX.DATE} ${video.videoId}: сохраняем существующую дату из БД: ${existingDate}`);
          video.publishDate = existingDate;
        } else {
          video.publishDate = null;
        }
        datesFailed++;
      }

      // Небольшая задержка между запросами чтобы не перегружать API
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log(`${LOG_PREFIX.DATE} ========== ИТОГИ ПОЛУЧЕНИЯ ДАТ ==========`);
    console.log(`${LOG_PREFIX.DATE} Успешно получено: ${datesSuccess}`);
    console.log(`${LOG_PREFIX.DATE} Использовано из БД: ${datesSkipped}`);
    console.log(`${LOG_PREFIX.DATE} Не удалось получить: ${datesFailed}`);

    // === СОХРАНЕНИЕ В БД ===
    console.log(`${LOG_PREFIX.DB_WRITE} ========== СОХРАНЕНИЕ В БД ==========`);

    let inserted = 0;
    let updated = 0;
    let updatedWithNewDate = 0;
    let videosWithoutDate = 0;

    for (const video of limitedVideos) {
      // Проверяем, существует ли уже такое видео
      const existingResult = await client.execute({
        sql: "SELECT id, publishDate, title FROM channel_videos WHERE channelId = ? AND videoId = ?",
        args: [competitor.channelId, video.videoId],
      });

      const hasPublishDate = video.publishDate && video.publishDate.length > 0;

      if (!hasPublishDate) {
        videosWithoutDate++;
        console.warn(`${LOG_PREFIX.DB_WRITE} ${LOG_PREFIX.FAIL} Видео "${video.title?.slice(0, 50)}..." (${video.videoId}) БЕЗ publishDate`);
      }

      if (existingResult.rows.length > 0) {
        // Обновляем существующее видео
        const existing = existingResult.rows[0];
        const oldDate = existing.publishDate as string | null;

        // ВАЖНО: НИКОГДА не перезаписываем существующую дату на null!
        const finalPublishDate = video.publishDate || oldDate;

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
            finalPublishDate, // Никогда не null если раньше была дата!
            video.duration || null,
            Date.now(),
            existing.id,
          ],
        });

        if (oldDate !== finalPublishDate && finalPublishDate) {
          console.log(`${LOG_PREFIX.DB_WRITE} ${LOG_PREFIX.SUCCESS} UPDATE ${video.videoId}: publishDate ${oldDate || 'null'} → ${finalPublishDate}`);
          updatedWithNewDate++;
        } else if (!oldDate && !finalPublishDate) {
          console.log(`${LOG_PREFIX.DB_WRITE} UPDATE ${video.videoId}: publishDate остаётся null (нужна повторная синхронизация)`);
        }

        updated++;
      } else {
        // Вставляем новое видео
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

        if (video.publishDate) {
          console.log(`${LOG_PREFIX.DB_WRITE} ${LOG_PREFIX.SUCCESS} INSERT ${video.videoId}: publishDate = ${video.publishDate}`);
        } else {
          console.log(`${LOG_PREFIX.DB_WRITE} INSERT ${video.videoId}: publishDate = null (нужна повторная синхронизация)`);
        }

        inserted++;
      }
    }

    // Подсчитываем общее количество видео и видео без дат
    const totalVideosResult = await client.execute({
      sql: "SELECT COUNT(*) as count FROM channel_videos WHERE channelId = ?",
      args: [competitor.channelId],
    });

    const videosWithoutDateResult = await client.execute({
      sql: "SELECT COUNT(*) as count FROM channel_videos WHERE channelId = ? AND (publishDate IS NULL OR publishDate = '')",
      args: [competitor.channelId],
    });

    const totalInDb = Number(totalVideosResult.rows[0]?.count || 0);
    const withoutDateInDb = Number(videosWithoutDateResult.rows[0]?.count || 0);

    console.log(`${LOG_PREFIX.SYNC} ========== ИТОГИ СИНХРОНИЗАЦИИ ==========`);
    console.log(`${LOG_PREFIX.SYNC} Добавлено: ${inserted}`);
    console.log(`${LOG_PREFIX.SYNC} Обновлено: ${updated} (из них с новой датой: ${updatedWithNewDate})`);
    console.log(`${LOG_PREFIX.SYNC} Всего в БД: ${totalInDb}`);
    console.log(`${LOG_PREFIX.SYNC} Без publishDate в БД: ${withoutDateInDb}`);

    if (withoutDateInDb > 0) {
      console.warn(`${LOG_PREFIX.SYNC} ${LOG_PREFIX.FAIL} ВНИМАНИЕ: ${withoutDateInDb} видео без publishDate! Требуется повторная синхронизация.`);
    }

    client.close();

    return NextResponse.json(
      {
        status: "ok",
        added: inserted,
        updated: updated,
        updatedWithNewDate,
        totalVideos: totalInDb,
        videosWithoutDate: withoutDateInDb,
        // Информация о датах
        dates: {
          success: datesSuccess,
          fromDb: datesSkipped,
          failed: datesFailed,
        },
        // Информация о лимитах для UI
        plan: userPlan,
        videoLimit: maxVideos,
        videosFromApi: videos.length,
      },
      { status: 200 }
    );
  } catch (error) {
    client.close();
    console.error(`${LOG_PREFIX.SYNC} ${LOG_PREFIX.ERROR} Ошибка при синхронизации:`, error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to sync channel videos" },
      { status: 500 }
    );
  }
}
