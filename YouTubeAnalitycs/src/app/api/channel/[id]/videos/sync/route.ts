import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createClient } from "@libsql/client";
import { getYoutubeChannelVideos, getYoutubeVideoDetails } from "@/lib/scrapecreators";
import { getUserPlan } from "@/lib/user-plan";

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

/**
 * Нормализует данные видео, гарантируя что все числовые поля имеют безопасные значения
 * Преобразует undefined/null в 0 для viewCount, likeCount, commentCount
 */
function normalizeVideoData(video: any) {
  return {
    id: video.id,
    channelId: video.channelId,
    videoId: video.videoId,
    title: video.title ?? "Untitled",
    thumbnailUrl: video.thumbnailUrl ?? null,
    viewCount: typeof video.viewCount === "number" && Number.isFinite(video.viewCount) ? video.viewCount : 0,
    likeCount: typeof video.likeCount === "number" && Number.isFinite(video.likeCount) ? video.likeCount : 0,
    commentCount: typeof video.commentCount === "number" && Number.isFinite(video.commentCount) ? video.commentCount : 0,
    publishDate: video.publishDate ?? null,
    duration: video.duration ?? null,
    fetchedAt: video.fetchedAt ?? Date.now(),
  };
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
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    // Защита: id должен быть непустой строкой (это channelId, а не competitorId)
    if (!id || typeof id !== 'string' || id.trim() === '' || id === 'undefined') {
      client.close();
      return NextResponse.json({ success: false, error: "channelId is missing or invalid" }, { status: 400 });
    }

    const channelId = id;
    console.log(`[Sync] Начало синхронизации для channelId: ${channelId}`);

    // Проверяем что этот channelId принадлежит текущему пользователю
    const competitorResult = await client.execute({
      sql: "SELECT id, title FROM competitors WHERE channelId = ? AND userId = ?",
      args: [channelId, session.user.id],
    });

    if (competitorResult.rows.length === 0) {
      client.close();
      return NextResponse.json({ success: false, error: "Channel not found or not authorized" }, { status: 404 });
    }

    const competitor = competitorResult.rows[0];
    console.log(`[Sync] Канал: ${competitor.title}`);

    const MAX_VIDEOS_PER_PAGE = 12;
    const userPlan = getUserPlan(session);

    // ШАГ 1: ПРОВЕРЯЕМ ЕСТЬ ЛИ УЖЕ 12 ВИДЕО В БД С PUBLISHDATE
    console.log(`[Sync] Проверяем наличие видео в БД для channelId: ${channelId}`);
    const existingVideosResult = await client.execute({
      sql: `SELECT id, channelId, videoId, title, thumbnailUrl, viewCount, likeCount, commentCount, publishDate, duration, fetchedAt FROM channel_videos
            WHERE channelId = ?
            ORDER BY viewCount DESC
            LIMIT ?`,
      args: [channelId, MAX_VIDEOS_PER_PAGE],
    });

    const existingVideos = existingVideosResult.rows || [];
    const videosWithPublishDate = existingVideos.filter((v: any) => v.publishDate != null);

    // Если уже есть 12+ видео с publishDate - не идем в API
    if (videosWithPublishDate.length >= MAX_VIDEOS_PER_PAGE) {
      console.log(`[Sync] В БД уже есть ${videosWithPublishDate.length} видео с publishDate, используем их без API`);

      // Обновляем lastSyncAt
      try {
        const lastSyncAtIso = new Date().toISOString();
        await client.execute({
          sql: `INSERT INTO user_channel_state (userId, channelId, hasSyncedTopVideos, lastSyncAt)
                VALUES (?, ?, 1, ?)
                ON CONFLICT(userId, channelId) DO UPDATE SET hasSyncedTopVideos = 1, lastSyncAt = ?`,
          args: [session.user.id, channelId, lastSyncAtIso, lastSyncAtIso],
        });
      } catch (e) {
        console.warn(`[Sync] Ошибка обновления lastSyncAt:`, e instanceof Error ? e.message : e);
      }

      client.close();

      // Нормализуем видео перед отправкой (гарантируем безопасные значения)
      const normalizedCachedVideos = existingVideos.slice(0, MAX_VIDEOS_PER_PAGE).map(normalizeVideoData);

      return NextResponse.json({
        success: true,
        videos: normalizedCachedVideos,
        totalVideos: existingVideos.length,
        added: 0,
        updated: 0,
        source: "db_cache",
        plan: userPlan,
        videoLimit: MAX_VIDEOS_PER_PAGE,
      });
    }

    // ШАГ 2: ЕСЛИ ДАННЫХ НЕТ - ХОДИМ В API
    console.log(`[Sync] В БД найдено только ${existingVideos.length} видео, загружаем из API`);

    let totalAvailableVideos = 0;

    // Загружаем видео из API (TOP-12 ONLY)
    let apiResponse;
    try {
      apiResponse = await getYoutubeChannelVideos(
        channelId,
        competitor.handle as string,
        MAX_VIDEOS_PER_PAGE
      );
    } catch (error) {
      console.error("[Sync] Ошибка получения списка видео:", error);
      client.close();
      const errorMsg = error instanceof Error ? error.message : "Failed to fetch videos";
      return NextResponse.json(
        { success: false, error: errorMsg },
        { status: 500 }
      );
    }

    // Извлекаем видео из ответа (API уже вернул их отсортированными по popular/viewCount)
    // Но мы сортируем сами для гарантии TOP-12 по viewCount DESC
    const apiVideos = (apiResponse.videos || apiResponse) as any[];
    const sortedVideos = apiVideos.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
    const videos = sortedVideos.slice(0, MAX_VIDEOS_PER_PAGE);
    totalAvailableVideos = videos.length;

    console.log(`[Sync] Из ScrapeCreators получено ${apiVideos.length} видео (sort=popular), отобрано TOP-${MAX_VIDEOS_PER_PAGE} по viewCount DESC`);

    if (videos.length === 0) {
      console.warn(`[Sync] ВНИМАНИЕ: API не вернул видео!`);
      client.close();
      return NextResponse.json({
        success: true,
        videos: [],
        totalVideos: 0,
        added: 0,
        updated: 0,
        source: "api",
        plan: userPlan,
        videoLimit: MAX_VIDEOS_PER_PAGE,
      });
    }

    // Получаем publishDate для каждого видео из API
    console.log(`[Sync] Получаем publishDate для ${videos.length} видео`);
    let publishDateResolvedCount = 0;
    for (const video of videos) {
      if (!video.videoId) continue;
      if (!video.publishDate) {
        const publishDate = await fetchPublishDateWithRetry(video.videoId);
        video.publishDate = publishDate;
        publishDateResolvedCount++;
        await new Promise(resolve => setTimeout(resolve, 150));
      }
    }
    console.log(`[Sync] Получено publishDate для ${publishDateResolvedCount} видео`);

    // Сохраняем в локальную таблицу channel_videos
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    console.log(`[Sync] Начинаем сохранять ${videos.length} видео в БД`);

    for (const video of videos) {
      if (!video.videoId) {
        console.warn(`[Sync] Пропущено видео без videoId:`, { title: video.title });
        skipped++;
        continue;
      }

      // ⚠️ ВАЖНО: используем валидированную переменную channelId, НЕ competitor.channelId
      console.log(`[DB] Проверяем видео videoId=${video.videoId}, channelId=${channelId}`);

      const existingResult = await client.execute({
        sql: "SELECT id, publishDate FROM channel_videos WHERE channelId = ? AND videoId = ?",
        args: [channelId, video.videoId],
      });

      if (existingResult.rows.length > 0) {
        const existing = existingResult.rows[0];
        const oldDate = existing.publishDate as string | null;
        const finalDate = video.publishDate || oldDate;

        console.log(`[DB] UPDATE: videoId=${video.videoId}, id=${existing.id}`);

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
        console.log(`[DB] INSERT: videoId=${video.videoId}, channelId=${channelId}`);

        await client.execute({
          sql: `INSERT INTO channel_videos (
            channelId, videoId, title, thumbnailUrl, viewCount,
            likeCount, commentCount, publishDate, duration, fetchedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            channelId,
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

    // Обновляем состояние пользователя
    try {
      const lastSyncAtIso = new Date().toISOString();
      console.log(`[DB] Обновляем user_channel_state: userId=${session.user.id}, channelId=${channelId}`);

      await client.execute({
        sql: `INSERT INTO user_channel_state (userId, channelId, hasSyncedTopVideos, lastSyncAt)
              VALUES (?, ?, 1, ?)
              ON CONFLICT(userId, channelId) DO UPDATE SET hasSyncedTopVideos = 1, lastSyncAt = ?`,
        args: [session.user.id, channelId, lastSyncAtIso, lastSyncAtIso],
      });
      console.log(`[Sync] Обновлено состояние пользователя: lastSyncAt = ${lastSyncAtIso}`);
    } catch (stateError) {
      console.warn(`[Sync] Ошибка обновления состояния:`, stateError instanceof Error ? stateError.message : stateError);
    }

    // Гарантируем полный flush WAL перед ответом клиенту
    try {
      await client.execute(`PRAGMA wal_checkpoint(FULL);`);
      console.log("[Sync] WAL checkpoint завершён успешно");
    } catch (walError) {
      console.warn("[Sync] Ошибка при WAL checkpoint (не критично):", walError instanceof Error ? walError.message : walError);
    }

    client.close();

    // Нормализуем видео перед отправкой (гарантируем безопасные значения)
    const normalizedApiVideos = videos.slice(0, MAX_VIDEOS_PER_PAGE).map(normalizeVideoData);

    return NextResponse.json({
      success: true,
      videos: normalizedApiVideos,
      totalVideos,
      added: inserted,
      updated,
      source: "api",
      plan: userPlan,
      videoLimit: MAX_VIDEOS_PER_PAGE,
    });
  } catch (error) {
    client.close();
    const errorMessage = error instanceof Error ? error.message : "Sync failed";
    console.error("[Sync] Ошибка:", error);
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
