/**
 * Единый механизм восстановления даты публикации видео
 * Многоступенчатый fallback для получения корректной даты
 *
 * Приоритет:
 * 1. ScrapeCreators publishedAt (если валидна)
 * 2. YouTube oEmbed API
 * 3. Интерполяция по соседним видео
 * 4. Дата первого комментария
 * 5. Оценка по viewsPerDay
 * 6. null если всё провалилось
 */

import { createClient } from "@libsql/client";

export interface VideoDataForResolver {
  id?: string;
  videoId: string;
  publishedAt?: string | null;
  viewCount?: number;
  viewsPerDay?: number;
  title?: string;
}

export interface CommentDataForResolver {
  id: string;
  publishedTime?: string | null;
  publishedAt?: string | null;
}

export interface VideoNeighbors {
  prev?: VideoDataForResolver;
  next?: VideoDataForResolver;
}

/**
 * Проверяет, является ли строка валидной ISO 8601 датой
 */
function isValidISODate(dateStr: string | undefined | null): boolean {
  if (!dateStr || typeof dateStr !== "string") return false;

  // Исключаем явно невалидные даты
  if (
    dateStr.startsWith("0000") ||
    dateStr.startsWith("0001") ||
    dateStr === "null" ||
    dateStr.toLowerCase() === "invalid date"
  ) {
    return false;
  }

  try {
    const date = new Date(dateStr);
    // Проверяем что дата парсится корректно и не в будущем более чем на день
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    return !isNaN(date.getTime()) && date <= tomorrow;
  } catch {
    return false;
  }
}

/**
 * Нормализует дату к ISO 8601 формату (YYYY-MM-DD)
 */
function normalizeToISODate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;

  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split("T")[0];
  } catch {
    return null;
  }
}

/**
 * Санити-чек для разрешённой даты
 * Отклоняет даты из будущего и логирует их
 */
function sanitizeResolvedDate(
  videoId: string,
  dateStr: string | null | undefined,
  stepName: string
): string | null {
  if (!dateStr) return null;

  try {
    const dateObj = new Date(dateStr);
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Отклоняем даты из будущего
    if (dateObj > tomorrow) {
      console.warn(
        `[PublishDate][SANITY CHECK] ${stepName} returned future date for ${videoId}: ${dateStr}, rejecting`
      );
      return null;
    }

    return dateStr;
  } catch (error) {
    console.warn(`[PublishDate][SANITY CHECK] Error checking date for ${videoId}`);
    return null;
  }
}

/**
 * Шаг 1: Проверяет ScrapeCreators publishedAt
 */
function resolveScrapeCreatorsDate(
  scraped: VideoDataForResolver
): string | null {
  if (isValidISODate(scraped.publishedAt)) {
    const normalized = normalizeToISODate(scraped.publishedAt);
    if (normalized) {
      const sanitized = sanitizeResolvedDate(scraped.videoId, normalized, "Step 1");
      if (sanitized) {
        console.log(
          `[PublishDate] Step 1 SUCCESS: ScrapeCreators date for ${scraped.videoId}: ${sanitized}`
        );
        return sanitized;
      }
    }
  }
  return null;
}

/**
 * Шаг 2: YouTube oEmbed API
 */
async function fetchYoutubeOEmbedDate(videoId: string): Promise<string | null> {
  try {
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5 сек timeout

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(
        `[PublishDate] oEmbed request failed with status ${response.status} for video ${videoId}`
      );
      return null;
    }

    const data = await response.json();

    // oEmbed может содержать published_at, upload_date или похожее поле
    if (data.published_at) {
      const normalized = normalizeToISODate(data.published_at);
      if (normalized) {
        const sanitized = sanitizeResolvedDate(videoId, normalized, "Step 2");
        if (sanitized) {
          console.log(
            `[PublishDate] Step 2 SUCCESS: YouTube oEmbed date for ${videoId}: ${sanitized}`
          );
          return sanitized;
        }
      }
    }

    return null;
  } catch (error) {
    console.warn(
      `[PublishDate] oEmbed fetch error for ${videoId}:`,
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

/**
 * Шаг 3: Интерполяция по соседним видео
 * КОНСЕРВАТИВНЫЙ подход: интерполируем ТОЛЬКО если есть обе даты (prev и next)
 * Step 3b и 3c отключены как ненадёжные (приводят к одинаковым датам)
 */
function resolveByNeighbors(
  neighbors: VideoNeighbors | undefined,
  videoId: string
): string | null {
  if (!neighbors) {
    console.log(`[PublishDate][DEBUG] No neighbors for ${videoId}`);
    return null;
  }

  const prevDate = neighbors.prev?.publishedAt;
  const nextDate = neighbors.next?.publishedAt;

  console.log(
    `[PublishDate][DEBUG Step 3] Neighbors for ${videoId}:`,
    {
      prevVideoId: neighbors.prev?.videoId,
      prevDate,
      nextVideoId: neighbors.next?.videoId,
      nextDate,
    }
  );

  // ТОЛЬКО Step 3a: Если есть обе даты - берём середину
  // Это ЕДИНСТВЕННЫЙ надёжный способ интерполяции
  if (isValidISODate(prevDate) && isValidISODate(nextDate)) {
    try {
      const prev = new Date(prevDate!).getTime();
      const next = new Date(nextDate!).getTime();

      // Санити-чек: prev должен быть раньше next
      if (prev >= next) {
        console.warn(
          `[PublishDate] Step 3a SKIPPED: prev date >= next date for ${videoId}`
        );
        return null;
      }

      const middle = new Date((prev + next) / 2);
      const result = middle.toISOString().split("T")[0];

      const sanitized = sanitizeResolvedDate(videoId, result, "Step 3a");
      if (sanitized) {
        console.log(
          `[PublishDate] Step 3a SUCCESS: Interpolated date from neighbors: ${sanitized}`
        );
        return sanitized;
      }
      return null;
    } catch (error) {
      console.warn(`[PublishDate] Step 3a ERROR:`, error);
      return null;
    }
  }

  // Step 3b и 3c отключены как ненадёжные
  // (приводили к одинаковым датам для всех видео без данных)
  if (isValidISODate(prevDate) && !isValidISODate(nextDate)) {
    console.log(
      `[PublishDate] Step 3b DISABLED: only prev date available, skipping (unreliable)`
    );
    return null;
  }

  if (!isValidISODate(prevDate) && isValidISODate(nextDate)) {
    console.log(
      `[PublishDate] Step 3c DISABLED: only next date available, skipping (unreliable)`
    );
    return null;
  }

  console.log(`[PublishDate] Step 3 SKIPPED: no valid neighbors`);
  return null;
}

/**
 * Шаг 4: Дата первого комментария (Вариант E)
 */
function resolveByFirstComment(
  comments: CommentDataForResolver[] | null | undefined,
  videoId: string
): string | null {
  if (!comments || !Array.isArray(comments) || comments.length === 0) {
    return null;
  }

  // Фильтруем и сортируем комментарии по дате
  const datedComments = comments
    .filter((c) => isValidISODate(c.publishedTime || c.publishedAt))
    .map((c) => ({
      date: new Date((c.publishedTime || c.publishedAt)!),
      original: c.publishedTime || c.publishedAt,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (datedComments.length > 0) {
    const firstDate = datedComments[0].original;
    const normalized = normalizeToISODate(firstDate);
    if (normalized) {
      const sanitized = sanitizeResolvedDate(videoId, normalized, "Step 4");
      if (sanitized) {
        console.log(
          `[PublishDate] Step 4 SUCCESS: First comment date: ${sanitized}`
        );
        return sanitized;
      }
    }
  }

  return null;
}

/**
 * Шаг 5: Оценка по viewsPerDay
 */
function resolveByViewsPerDay(video: VideoDataForResolver): string | null {
  const viewCount = video.viewCount ?? 0;
  const viewsPerDay = video.viewsPerDay ?? 0;

  // Проверяем что данные имеют смысл
  if (
    viewCount <= 0 ||
    viewsPerDay <= 0 ||
    !isFinite(viewsPerDay) ||
    viewsPerDay > viewCount
  ) {
    return null;
  }

  try {
    const days = viewCount / viewsPerDay;

    // Проверяем что количество дней разумно (от 0 до 10 лет)
    if (days < 0 || days > 3650) {
      return null;
    }

    const now = new Date();
    const estimated = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const result = estimated.toISOString().split("T")[0];

    const sanitized = sanitizeResolvedDate(video.videoId, result, "Step 5");
    if (sanitized) {
      console.log(
        `[PublishDate] Step 5 SUCCESS: Estimated by viewsPerDay (${days.toFixed(1)} days): ${sanitized}`
      );
      return sanitized;
    }
    return null;
  } catch (error) {
    console.warn(
      `[PublishDate] viewsPerDay calculation failed:`,
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

/**
 * Главная функция: многоступенчатое восстановление даты публикации
 */
export async function resolveVideoPublishDate(
  videoId: string,
  scraped: VideoDataForResolver,
  comments: CommentDataForResolver[] | null = null,
  neighbors?: VideoNeighbors
): Promise<string | null> {
  console.log(`\n[PublishDate] Starting resolution for video ${videoId}`);

  // Шаг 1: ScrapeCreators publishedAt
  const step1 = resolveScrapeCreatorsDate(scraped);
  if (step1) return step1;

  // Шаг 2: YouTube oEmbed (только для видео без даты)
  const step2 = await fetchYoutubeOEmbedDate(videoId);
  if (step2) return step2;

  // Шаг 3: Интерполяция по соседям
  const step3 = resolveByNeighbors(neighbors, videoId);
  if (step3) return step3;

  // Шаг 4: Дата первого комментария
  const step4 = resolveByFirstComment(comments, videoId);
  if (step4) return step4;

  // Шаг 5: viewsPerDay оценка
  const step5 = resolveByViewsPerDay(scraped);
  if (step5) return step5;

  // Шаг 6: Всё провалилось
  console.warn(`[PublishDate] FAILED to resolve date for video ${videoId}`);
  return null;
}

/**
 * Утилита: получить комментарии видео из БД
 */
export async function getVideoCommentsFromDB(
  videoId: string
): Promise<CommentDataForResolver[]> {
  try {
    const dbPath = process.env.DATABASE_URL || "file:sqlite.db";
    const client = createClient({
      url: dbPath.startsWith("file:") ? dbPath : `file:${dbPath}`,
    });

    const result = await client.execute({
      sql: "SELECT id, publishedTime FROM video_comments WHERE videoId = ? ORDER BY publishedTime ASC LIMIT 100",
      args: [videoId],
    });

    client.close();

    return result.rows.map((row: any) => ({
      id: row.id as string,
      publishedTime: row.publishedTime as string,
    }));
  } catch (error) {
    console.error(
      `[PublishDate] Failed to fetch comments for video ${videoId}:`,
      error
    );
    return [];
  }
}

/**
 * Утилита: получить соседних видео из БД
 */
export async function getVideoNeighborsFromDB(
  channelId: string,
  videoId: string
): Promise<VideoNeighbors | undefined> {
  try {
    const dbPath = process.env.DATABASE_URL || "file:sqlite.db";
    const client = createClient({
      url: dbPath.startsWith("file:") ? dbPath : `file:${dbPath}`,
    });

    // Получаем текущее видео для сравнения
    const currentResult = await client.execute({
      sql: "SELECT viewCount FROM channel_videos WHERE channelId = ? AND videoId = ? LIMIT 1",
      args: [channelId, videoId],
    });

    if (currentResult.rows.length === 0) {
      client.close();
      return undefined;
    }

    const currentViewCount = (currentResult.rows[0] as any)
      .viewCount as number;

    // Получаем предыдущее видео (чуть меньше просмотров)
    const prevResult = await client.execute({
      sql: "SELECT videoId, publishedAt, viewCount FROM channel_videos WHERE channelId = ? AND viewCount < ? ORDER BY viewCount DESC LIMIT 1",
      args: [channelId, currentViewCount],
    });

    // Получаем следующее видео (чуть больше просмотров)
    const nextResult = await client.execute({
      sql: "SELECT videoId, publishedAt, viewCount FROM channel_videos WHERE channelId = ? AND viewCount > ? ORDER BY viewCount ASC LIMIT 1",
      args: [channelId, currentViewCount],
    });

    client.close();

    return {
      prev: prevResult.rows.length > 0 ? (prevResult.rows[0] as any) : undefined,
      next: nextResult.rows.length > 0 ? (nextResult.rows[0] as any) : undefined,
    };
  } catch (error) {
    console.error(
      `[PublishDate] Failed to fetch neighbors for video ${videoId}:`,
      error
    );
    return undefined;
  }
}
