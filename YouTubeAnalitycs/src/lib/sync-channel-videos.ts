/**
 * Синхронизация TOP-12 видео канала в БД
 *
 * Правила:
 * 1. Если в БД уже ≥12 видео для канала → ничего не делать (кеш)
 * 2. Иначе → получить из ScrapeCreators, получить publishDate, сохранить в БД
 *
 * Видео сохраняются ГЛОБАЛЬНО (не привязаны к пользователю)
 */

import { createClient } from "@libsql/client";
import { getYoutubeChannelVideos, getYoutubeVideoDetails } from "@/lib/scrapecreators";

interface VideoData {
  videoId: string;
  title: string;
  thumbnailUrl: string | null;
  viewCountInt: number;
  likeCountInt: number;
  commentCountInt: number;
  publishDate: string | null;
  durationSeconds?: number;
}

const MAX_VIDEOS = 12;
const RETRY_DELAYS = [200, 400, 800];

/**
 * Получает полные данные видео (publishDate, likeCount, commentCount, duration) с retry (3 попытки)
 */
async function fetchVideoFullDetailsWithRetry(videoId: string): Promise<{
  publishDate: string | null;
  likeCount: number;
  commentCount: number;
  durationSeconds: number | undefined;
}> {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

  for (let attempt = 0; attempt < RETRY_DELAYS.length; attempt++) {
    try {
      const details = await getYoutubeVideoDetails(videoUrl);
      console.log(`[SyncVideos] ${videoId}: Получены полные данные (попытка ${attempt + 1}):`, {
        publishDate: details.publishDate,
        likeCount: details.likeCount,
        commentCount: details.commentCount,
        durationMs: details.durationMs,
      });

      // Конвертируем durationMs в durationSeconds
      const durationSeconds = details.durationMs ? Math.floor(details.durationMs / 1000) : undefined;

      return {
        publishDate: details.publishDate,
        likeCount: details.likeCount,
        commentCount: details.commentCount,
        durationSeconds,
      };
    } catch (err) {
      console.warn(
        `[SyncVideos] ${videoId}: ошибка при получении данных (попытка ${attempt + 1}):`,
        err instanceof Error ? err.message : err
      );
    }

    if (attempt < RETRY_DELAYS.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS[attempt]));
    }
  }

  console.log(`[SyncVideos] ${videoId}: не удалось получить полные данные видео`);
  return {
    publishDate: null,
    likeCount: 0,
    commentCount: 0,
    durationSeconds: undefined,
  };
}

/**
 * Нормализует видео перед сохранением в БД
 * Гарантирует что ВСЕ значения безопасны (нет undefined)
 */
function createSafeVideoForDB(video: any, channelId: string): VideoData {
  const safeVideo = {
    videoId: String(video.videoId || "").trim() || "",
    title: String(video.title || "Untitled").trim(),
    thumbnailUrl: video.thumbnailUrl ? String(video.thumbnailUrl).trim() : null,
    viewCountInt: typeof video.viewCount === "number" && Number.isFinite(video.viewCount) ? Math.floor(video.viewCount) : 0,
    likeCountInt: typeof video.likeCount === "number" && Number.isFinite(video.likeCount) ? Math.floor(video.likeCount) : 0,
    commentCountInt: typeof video.commentCount === "number" && Number.isFinite(video.commentCount) ? Math.floor(video.commentCount) : 0,
    publishDate: video.publishDate ? String(video.publishDate).trim() : null,
    durationSeconds: video.durationSeconds ? Math.floor(video.durationSeconds) : undefined,
  };

  // КРИТИЧЕСКОЕ ЛОГИРОВАНИЕ: показываем какие данные попадают в БД
  console.log(`[SyncVideos] createSafeVideoForDB для ${safeVideo.videoId}:`, {
    title: safeVideo.title,
    viewCountInt: safeVideo.viewCountInt,
    likeCountInt: safeVideo.likeCountInt,
    commentCountInt: safeVideo.commentCountInt,
    durationSeconds: safeVideo.durationSeconds,
    publishDate: safeVideo.publishDate,
  });

  return safeVideo;
}

/**
 * Синхронизирует TOP-12 видео канала
 *
 * @param channelId YouTube Channel ID (строка, например UCxxxxxx)
 * @param handle YouTube handle (опционально, используется если нет channelId)
 * @returns { success: boolean, source: "api" | "db", totalVideos: number }
 */
export async function syncChannelTopVideos(
  channelId: string,
  handle?: string
): Promise<{ success: boolean; source: "api" | "db"; totalVideos: number }> {
  const dbPath = process.env.DATABASE_URL || "file:sqlite.db";
  const client = createClient({
    url: dbPath.startsWith("file:") ? dbPath : `file:${dbPath}`,
  });

  try {
    console.log(`[SyncVideos] Начало синхронизации для channelId: ${channelId}`);

    // ШАГ 1: Проверяем есть ли уже видео в БД
    const existingVideosResult = await client.execute({
      sql: `SELECT id FROM channel_videos WHERE channelId = ? LIMIT ?`,
      args: [channelId, MAX_VIDEOS],
    });

    const existingVideosCount = existingVideosResult.rows.length;

    if (existingVideosCount >= MAX_VIDEOS) {
      console.log(
        `[SyncVideos] В БД уже есть ${existingVideosCount} видео, используем кеш`
      );
      return { success: true, source: "db", totalVideos: existingVideosCount };
    }

    console.log(
      `[SyncVideos] В БД найдено ${existingVideosCount} видео, загружаем из API`
    );

    // ШАГ 2: Получаем видео из ScrapeCreators (sort=popular, с fallback на sort=latest)
    let apiVideos;
    try {
      console.log(`[SyncVideos] 🔵 Попытка 1: Запрашиваем видео (sort=popular) для channelId=${channelId}, handle=${handle}`);
      let response = await getYoutubeChannelVideos(
        channelId,
        handle,
        MAX_VIDEOS * 2, // Запрашиваем больше на случай фильтрации
        null,
        undefined,
        "popular"  // ПЕРВАЯ ПОПЫТКА: sort=popular
      );

      // IMPORTANT: response is ChannelVideosResponse { videos: [...], continuationToken: ... }
      if (!response || typeof response !== 'object') {
        console.error(`[SyncVideos] Invalid response structure:`, { responseType: typeof response });
        throw new Error("Invalid API response structure");
      }

      apiVideos = response.videos;

      if (!Array.isArray(apiVideos)) {
        console.error(`[SyncVideos] response.videos is not an array:`, {
          videosType: typeof apiVideos,
          responseKeys: Object.keys(response)
        });
        throw new Error("API videos is not an array");
      }

      // FALLBACK: если popular вернул 0 видео, пробуем latest
      if (apiVideos.length === 0) {
        console.warn(`[SyncVideos] ⚠️ sort=popular вернул 0 видео. Пробуем FALLBACK: sort=latest`);
        try {
          const fallbackResponse = await getYoutubeChannelVideos(
            channelId,
            handle,
            MAX_VIDEOS * 2,
            null,
            undefined,
            "latest"  // FALLBACK: sort=latest
          );

          if (fallbackResponse && Array.isArray(fallbackResponse.videos) && fallbackResponse.videos.length > 0) {
            console.log(`[SyncVideos] ✅ Fallback на sort=latest вернул ${fallbackResponse.videos.length} видео`);
            apiVideos = fallbackResponse.videos;
            response = fallbackResponse;
          } else {
            console.warn(`[SyncVideos] ❌ Fallback на sort=latest тоже вернул 0 видео`);
          }
        } catch (fallbackError) {
          console.warn(`[SyncVideos] Ошибка при fallback на sort=latest:`, fallbackError instanceof Error ? fallbackError.message : fallbackError);
        }
      } else {
        console.log(`[SyncVideos] ✅ sort=popular вернул ${apiVideos.length} видео`);
      }

      console.log(`[SyncVideos] Получено ${apiVideos.length} видео из API`, {
        responseStructure: { hasVideos: !!response.videos, hasContinuation: !!response.continuationToken },
        sampleVideoIds: apiVideos.slice(0, 3).map((v: any) => v.videoId || v.id || 'MISSING'),
      });
    } catch (error) {
      console.error("[SyncVideos] Ошибка получения списка видео:", error);
      throw error;
    }

    // ШАГ 3: Фильтруем и сортируем TOP-12 по viewCount
    const videosBeforeFilter = apiVideos.length;
    const videosWithoutId = apiVideos.filter((v) => !v.videoId).length;

    const filtered = apiVideos
      .filter((v) => v.videoId)
      .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))
      .slice(0, MAX_VIDEOS);

    console.log(`[SyncVideos] Фильтрация видео:`, {
      before: videosBeforeFilter,
      videosWithoutId,
      after: filtered.length,
      filtered: filtered.map((v) => ({ videoId: v.videoId, title: v.title, viewCount: v.viewCount })),
    });

    if (filtered.length === 0) {
      console.warn(`[SyncVideos] API не вернул видео для channelId: ${channelId}. Возможные причины:`, {
        totalVideosFromAPI: videosBeforeFilter,
        videosWithoutId,
        apiVideos: apiVideos.slice(0, 2).map((v: any) => ({ id: v.id, videoId: v.videoId, title: v.title })),
      });
      return { success: true, source: "api", totalVideos: 0 };
    }

    console.log(
      `[SyncVideos] Получены ${filtered.length} видео из ScrapeCreators`
    );

    // ШАГ 4: Получаем полные данные видео (publishDate, likeCount, commentCount, duration)
    console.log(`[SyncVideos] Получаем полные данные для ${filtered.length} видео`);
    let detailsCount = 0;
    for (const video of filtered) {
      if (!video.videoId) continue;

      const videoDetails = await fetchVideoFullDetailsWithRetry(video.videoId);

      // Обновляем все поля из полученных данных
      if (videoDetails.publishDate) {
        video.publishDate = videoDetails.publishDate;
      }
      // КРИТИЧЕСКИ: обновляем likeCount и commentCount из полного API ответа
      // Это переопишет нулевые значения из getYoutubeChannelVideos
      video.likeCount = videoDetails.likeCount;
      video.commentCount = videoDetails.commentCount;
      video.durationSeconds = videoDetails.durationSeconds;

      detailsCount++;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    console.log(
      `[SyncVideos] Получены полные данные для ${detailsCount} видео`
    );

    // ШАГ 5: Сохраняем в БД
    let inserted = 0;
    let updated = 0;
    const now = Date.now();

    console.log(`[SyncVideos] Начинаем сохранять ${filtered.length} видео в БД для channelId: ${channelId}`);

    for (const video of filtered) {
      if (!video.videoId) {
        console.warn("[SyncVideos] Пропущено видео без videoId", { title: video.title });
        continue;
      }

      const safeVideo = createSafeVideoForDB(video, channelId);
      console.log(`[SyncVideos] Перед сохранением видео: ${safeVideo.videoId}`, {
        title: safeVideo.title,
        viewCountInt: safeVideo.viewCountInt,
        likeCountInt: safeVideo.likeCountInt,
        commentCountInt: safeVideo.commentCountInt,
        durationSeconds: safeVideo.durationSeconds,
        publishDate: safeVideo.publishDate,
        channelId,
      });

      // Проверяем существует ли видео
      const existingResult = await client.execute({
        sql: "SELECT id FROM channel_videos WHERE videoId = ?",
        args: [safeVideo.videoId],
      });

      if (existingResult.rows.length > 0) {
        // UPDATE
        const existing = existingResult.rows[0];
        const updateArgs = [
          channelId,
          safeVideo.title,
          safeVideo.thumbnailUrl,
          safeVideo.viewCountInt,
          safeVideo.likeCountInt,
          safeVideo.commentCountInt,
          safeVideo.publishDate,
          safeVideo.durationSeconds || null,
          now,
          existing.id,
        ];
        console.log(`[SyncVideos] UPDATE видео ${safeVideo.videoId}`, {
          id: existing.id,
          likeCountInt: safeVideo.likeCountInt,
          commentCountInt: safeVideo.commentCountInt,
          durationSeconds: safeVideo.durationSeconds || null,
          publishDate: safeVideo.publishDate,
        });
        await client.execute({
          sql: `UPDATE channel_videos SET
            channelId = ?,
            title = ?,
            thumbnailUrl = ?,
            viewCountInt = ?,
            likeCountInt = ?,
            commentCountInt = ?,
            publishDate = ?,
            durationSeconds = ?,
            updatedAt = ?
            WHERE id = ?`,
          args: updateArgs,
        });
        updated++;
        console.log(`[SyncVideos] UPDATE успешен для ${safeVideo.videoId}`);
      } else {
        // INSERT
        const insertArgs = [
          channelId,
          safeVideo.videoId,
          safeVideo.title,
          safeVideo.thumbnailUrl,
          safeVideo.viewCountInt,
          safeVideo.likeCountInt,
          safeVideo.commentCountInt,
          safeVideo.publishDate,
          safeVideo.durationSeconds || null,
          now,
          now,
        ];
        console.log(`[SyncVideos] INSERT новое видео ${safeVideo.videoId}:`, {
          likeCountInt: safeVideo.likeCountInt,
          commentCountInt: safeVideo.commentCountInt,
          durationSeconds: safeVideo.durationSeconds || null,
          publishDate: safeVideo.publishDate,
        });
        await client.execute({
          sql: `INSERT INTO channel_videos (
            channelId, videoId, title, thumbnailUrl, viewCountInt,
            likeCountInt, commentCountInt, publishDate, durationSeconds,
            fetchedAt, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: insertArgs,
        });
        inserted++;
        console.log(`[SyncVideos] INSERT успешен для ${safeVideo.videoId}`);
      }
    }

    // ШАГ 6: Гарантируем физическую запись
    try {
      await client.execute(`PRAGMA wal_checkpoint(FULL);`);
      console.log("[SyncVideos] WAL checkpoint успешно завершен");
    } catch (e) {
      console.warn("[SyncVideos] Ошибка WAL checkpoint:", e);
    }

    console.log(
      `[SyncVideos] Готово: добавлено ${inserted}, обновлено ${updated}`
    );

    return {
      success: true,
      source: "api",
      totalVideos: inserted + updated,
    };
  } catch (error) {
    console.error("[SyncVideos] Ошибка:", error);
    throw error;
  } finally {
    client.close();
  }
}
