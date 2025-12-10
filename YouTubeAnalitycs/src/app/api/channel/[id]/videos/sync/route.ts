import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createClient } from "@libsql/client";
import { getYoutubeChannelVideos, getYoutubeVideoDetails } from "@/lib/scrapecreators";
import { getVideoLimitForPlan } from "@/config/limits";
import { getUserPlan } from "@/lib/user-plan";
import {
  getCachedChannel,
  getCachedChannelVideos,
  saveChannelToCache,
  saveChannelVideosToCache,
} from "@/lib/cache/youtube-cache";

/**
 * POST /api/channel/[id]/videos/sync
 *
 * Синхронизация видео канала.
 * Единственное поле даты: publishDate (ISO 8601 строка)
 *
 * Логика:
 * 1. Если publishDate уже есть в БД → НЕ трогаем
 * 2. Если publishDate = null → получаем из API с retry
 * 3. Если API не вернул дату → оставляем null (не перезаписываем)
 */

/**
 * Получает publishDate с retry (3 попытки: 200ms → 400ms → 800ms)
 */
async function fetchPublishDateWithRetry(videoId: string): Promise<string | null> {
  const delays = [200, 400, 800];
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

  for (let attempt = 0; attempt < delays.length; attempt++) {
    try {
      const details = await getYoutubeVideoDetails(videoUrl);

      if (details.publishDate) {
        console.log(`[Sync] ${videoId}: publishDate = ${details.publishDate}`);
        return details.publishDate;
      }

      console.log(`[Sync] ${videoId}: API не вернул publishDate (попытка ${attempt + 1})`);
    } catch (err) {
      console.warn(`[Sync] ${videoId}: ошибка (попытка ${attempt + 1}):`, err instanceof Error ? err.message : err);
    }

    // Ждём перед следующей попыткой (кроме последней)
    if (attempt < delays.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delays[attempt]));
    }
  }

  console.log(`[Sync] ${videoId}: не удалось получить publishDate после ${delays.length} попыток`);
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

    console.log(`[Sync] Начало синхронизации, competitor ID: ${competitorId}`);

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
    console.log(`[Sync] Канал: ${competitor.title}`);

    // Проверяем глобальный кеш перед запросом API
    const channelId = competitor.channelId as string;
    const cachedVideos = await getCachedChannelVideos(channelId);
    const cachedChannel = await getCachedChannel(channelId);
    const cacheAgeMs = cachedChannel ? Date.now() - cachedChannel.lastUpdated : Infinity;
    const isCacheFresh = cachedVideos.length > 0 && cacheAgeMs < 24 * 60 * 60 * 1000; // 24 часа

    // Инициализируем переменные для обоих путей
    const userPlan = getUserPlan(session);
    const maxVideos = getVideoLimitForPlan(userPlan);
    let videos: typeof cachedVideos;

    // Получаем видео из кеша или API
    if (isCacheFresh && cachedChannel) {
      console.log(`[Sync] Кеш свежий (${Math.round(cacheAgeMs / 1000 / 60)} минут назад), используем кешированные данные`);
      videos = cachedVideos.slice(0, maxVideos);
      console.log(`[Sync] Из кеша: ${videos.length} видео`);
    } else {
      // Кеш старый или не существует - обновляем через API
      if (cachedChannel) {
        console.log(`[Sync] Кеш устарел (${Math.round(cacheAgeMs / 1000 / 60 / 60)} часов назад), обновляем через API`);
      } else {
        console.log(`[Sync] Кеш отсутствует, синхронизируем впервые`);
      }

      // Получаем список видео из API с лимитом по тарифу
      // 🔑 ОПТИМИЗАЦИЯ: передаём maxVideos чтобы API загружал только нужное количество
      let apiVideos;
      try {
        apiVideos = await getYoutubeChannelVideos(
          channelId,
          competitor.handle as string,
          maxVideos  // Передаём лимит, чтобы не загружать лишние страницы
        );
      } catch (error) {
        console.error("[Sync] Ошибка получения списка видео:", error);
        client.close();
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "Failed to fetch videos" },
          { status: 500 }
        );
      }

      console.log(`[Sync] Получено ${apiVideos.length} видео из API (лимит был: ${maxVideos})`);

      // ДИАГНОСТИКА: логируем структуру первого видео
      if (apiVideos.length > 0) {
        const firstVideo = apiVideos[0];
        console.log(`[Sync] Первое видео из API:`, {
          videoId: firstVideo.videoId,
          title: firstVideo.title,
          viewCount: firstVideo.viewCount,
          hasVideoId: !!firstVideo.videoId,
          videoIdLength: firstVideo.videoId?.length || 0,
        });
      } else {
        console.warn(`[Sync] ВНИМАНИЕ: API вернул 0 видео!`);
      }

      // ПРИМЕЧАНИЕ: apiVideos уже ограничены maxVideos, дополнительно НЕ обрезаем
      videos = apiVideos;
      console.log(`[Sync] Обрабатываем ${videos.length} видео (максимум: ${maxVideos})`);

      // Получаем существующие даты из БД только для API видео
      const existingDates = new Map<string, string | null>();
      for (const video of videos) {
        if (!video.videoId) continue;

        const existing = await client.execute({
          sql: "SELECT publishDate FROM channel_videos WHERE channelId = ? AND videoId = ?",
          args: [competitor.channelId, video.videoId],
        });

        if (existing.rows.length > 0) {
          existingDates.set(video.videoId, existing.rows[0].publishDate as string | null);
        }
      }

      // Получаем publishDate для видео БЕЗ даты (только для API видео, не для кешированных)
      for (const video of videos) {
        if (!video.videoId) continue;

        const existingDate = existingDates.get(video.videoId);

        // Если дата уже есть в БД → НЕ трогаем
        if (existingDate) {
          video.publishDate = existingDate;
          continue;
        }

        // Если даты нет → получаем из API
        const publishDate = await fetchPublishDateWithRetry(video.videoId);
        video.publishDate = publishDate; // может быть null

        // Задержка между запросами
        await new Promise(resolve => setTimeout(resolve, 150));
      }
    }

    // Сохраняем в локальную таблицу channel_videos
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    console.log(`[Sync] Начало сохранения ${videos.length} видео в БД`);

    for (const video of videos) {
      if (!video.videoId) {
        console.warn(`[Sync] Пропущено видео без videoId:`, { title: video.title, videoId: video.videoId });
        skipped++;
        continue;
      }

      const existingResult = await client.execute({
        sql: "SELECT id, publishDate FROM channel_videos WHERE channelId = ? AND videoId = ?",
        args: [competitor.channelId, video.videoId],
      });

      if (existingResult.rows.length > 0) {
        const existing = existingResult.rows[0];
        const oldDate = existing.publishDate as string | null;

        // Если старая дата есть, а новая null → сохраняем старую
        const finalDate = video.publishDate || oldDate;

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
            finalDate,
            video.duration || null,
            Date.now(),
            existing.id,
          ],
        });
        updated++;
      } else {
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
      args: [channelId],
    });

    const totalVideos = Number(totalResult.rows[0]?.count || 0);

    console.log(`[Sync] Готово: добавлено ${inserted}, обновлено ${updated}, пропущено ${skipped}, всего в БД ${totalVideos}`);

    // Сохраняем данные в глобальный кеш только если не из кеша (экономим API)
    if (!isCacheFresh) {
      try {
        const channelInfo = {
          channelId: competitor.channelId as string,
          title: competitor.title as string,
          handle: competitor.handle as string,
          avatarUrl: competitor.avatarUrl as string | null,
          subscriberCount: competitor.subscriberCount as number,
          videoCount: competitor.videoCount as number,
          viewCount: competitor.viewCount as number,
        };

        await saveChannelToCache(channelInfo);
        await saveChannelVideosToCache(channelId, videos);

        console.log(`[Sync] Сохранено в глобальный кеш: канал и ${videos.length} видео`);
      } catch (cacheError) {
        console.warn(`[Sync] Ошибка при сохранении в кеш (не критично):`, cacheError instanceof Error ? cacheError.message : cacheError);
        // Не прерываем sync, если кеш не сохранился
      }
    }

    // Обновляем состояние пользователя: отмечаем, что он синхронизировал видео этого канала
    try {
      const now = Date.now();
      await client.execute({
        sql: `INSERT INTO user_channel_state (userId, channelId, hasSyncedTopVideos, lastSyncAt)
              VALUES (?, ?, 1, ?)
              ON CONFLICT(userId, channelId) DO UPDATE SET hasSyncedTopVideos = 1, lastSyncAt = ?`,
        args: [session.user.id, channelId, now, now],
      });
      console.log(`[Sync] Обновлено состояние пользователя: hasSyncedTopVideos = 1, lastSyncAt = ${new Date(now).toISOString()}`);
    } catch (stateError) {
      console.warn(`[Sync] Ошибка при обновлении состояния пользователя (не критично):`, stateError instanceof Error ? stateError.message : stateError);
      // Не прерываем sync, если состояние не обновилось
    }

    client.close();

    return NextResponse.json({
      status: "ok",
      videos,
      totalVideos,
      added: inserted,
      updated,
      plan: userPlan,
      videoLimit: maxVideos,
      ...(isCacheFresh && { fromCache: true }),
    });
  } catch (error) {
    client.close();
    console.error("[Sync] Ошибка:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}
