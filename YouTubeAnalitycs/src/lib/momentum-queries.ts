import { db } from "./db";

/**
 * MomentumVideo interface
 * ЕДИНСТВЕННОЕ ПОЛЕ ДЛЯ ДАТЫ: publishDate (ISO 8601 string)
 */
export interface MomentumVideo {
  videoId: string;
  channelId: string;
  channelTitle: string;
  channelHandle?: string;
  title: string;
  url: string;
  publishDate: string; // ISO 8601 string из БД
  viewCount: number;
  likeCount?: number;
  commentCount?: number;
  viewsPerDay: number;
  momentumScore: number;
  category?: "High Momentum" | "Rising" | "Normal" | "Underperforming";
}

/**
 * Рассчитывает количество дней с момента публикации видео
 */
function daysSincePublish(publishDate: string | number): number {
  const date = new Date(publishDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return Math.max(1, diffMs / (1000 * 60 * 60 * 24)); // Минимум 1 день
}

/**
 * Рассчитывает медиану массива чисел
 */
function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle];
}

/**
 * Получает список всех каналов пользователя
 * @param userId ID пользователя
 * @returns Массив каналов пользователя
 */
export async function getUserChannels(userId: string): Promise<Array<{
  channelId: string;
  channelTitle: string;
  channelHandle?: string;
}>> {
  try {
    const competitorsResult = await db.execute({
      sql: `
        SELECT channelId, title as channelTitle, handle as channelHandle
        FROM competitors
        WHERE userId = ?
      `,
      args: [userId],
    });

    return competitorsResult.rows.map(row => ({
      channelId: row.channelId as string,
      channelTitle: row.channelTitle as string,
      channelHandle: row.channelHandle as string,
    }));
  } catch (error) {
    console.error("[MomentumQueries] Error getting user channels:", error);
    throw error;
  }
}

/**
 * Получает топ видео по momentum score для всех конкурентов пользователя
 * ИСТОЧНИК ДАТЫ: колонка publishDate в БД
 */
export async function getTopMomentumVideos(
  userId: string,
  limit: number = 50
): Promise<{
  items: MomentumVideo[];
  total: number;
  medianViewsPerDay: number;
  channels: Array<{
    channelId: string;
    channelTitle: string;
    channelHandle?: string;
  }>;
}> {
  try {
    // 1. Получаем всех конкурентов пользователя
    const competitorsResult = await db.execute({
      sql: `
        SELECT channelId, title as channelTitle, handle as channelHandle
        FROM competitors
        WHERE userId = ?
      `,
      args: [userId],
    });

    if (competitorsResult.rows.length === 0) {
      return { items: [], total: 0, medianViewsPerDay: 0, channels: [] };
    }

    const channelIds = competitorsResult.rows.map(row => row.channelId as string);
    const channelMap = new Map<string, { title: string; handle?: string }>();
    const channels: Array<{
      channelId: string;
      channelTitle: string;
      channelHandle?: string;
    }> = [];

    competitorsResult.rows.forEach(row => {
      const channelId = row.channelId as string;
      const channelTitle = row.channelTitle as string;
      const channelHandle = row.channelHandle as string;

      channelMap.set(channelId, {
        title: channelTitle,
        handle: channelHandle,
      });

      channels.push({
        channelId,
        channelTitle,
        channelHandle,
      });
    });

    // 2. Получаем все видео этих каналов
    // ЕДИНСТВЕННЫЙ ИСТОЧНИК ДАТЫ: publishDate
    const placeholders = channelIds.map(() => "?").join(",");
    const videosResult = await db.execute({
      sql: `
        SELECT
          v.videoId,
          v.channelId,
          v.title,
          v.publishDate,
          v.viewCount,
          v.likeCount,
          v.commentCount
        FROM channel_videos v
        WHERE v.channelId IN (${placeholders})
        ORDER BY v.viewCount DESC
      `,
      args: [...channelIds],
    });

    if (videosResult.rows.length === 0) {
      return { items: [], total: 0, medianViewsPerDay: 0, channels };
    }

    // 3. Рассчитываем viewsPerDay для каждого видео
    const videosWithMetrics: Array<{
      videoId: string;
      channelId: string;
      title: string;
      publishDate: string;
      viewCount: number;
      likeCount?: number;
      commentCount?: number;
      viewsPerDay: number;
      momentumScore: number;
    }> = [];

    for (const row of videosResult.rows) {
      const publishDate = row.publishDate as string;

      // Пропускаем видео без даты или с невалидной датой
      if (!publishDate || publishDate.startsWith("0000")) {
        console.warn(`[MomentumQueries] Skipping video ${row.videoId} with invalid date`);
        continue;
      }

      try {
        const date = new Date(publishDate);
        if (isNaN(date.getTime())) {
          console.warn(`[MomentumQueries] Skipping video ${row.videoId} with unparseable date: ${publishDate}`);
          continue;
        }
      } catch {
        continue;
      }

      const viewCount = Number(row.viewCount) || 0;

      // Рассчитываем days since publish
      const days = daysSincePublish(publishDate);
      const viewsPerDay = viewCount / days;

      videosWithMetrics.push({
        videoId: row.videoId as string,
        channelId: row.channelId as string,
        title: row.title as string,
        publishDate,
        viewCount,
        likeCount: row.likeCount ? Number(row.likeCount) : undefined,
        commentCount: row.commentCount ? Number(row.commentCount) : undefined,
        viewsPerDay,
        momentumScore: 0, // Будет рассчитан после
      });
    }

    if (videosWithMetrics.length === 0) {
      console.warn("[MomentumQueries] No videos with valid publication dates");
      return { items: [], total: 0, medianViewsPerDay: 0, channels };
    }

    // 4. Рассчитываем медиану viewsPerDay
    const viewsPerDayValues = videosWithMetrics.map(v => v.viewsPerDay);
    const medianViewsPerDay = calculateMedian(viewsPerDayValues);

    // 5. Рассчитываем momentumScore для каждого видео
    videosWithMetrics.forEach(video => {
      if (medianViewsPerDay > 0) {
        video.momentumScore = (video.viewsPerDay / medianViewsPerDay) - 1;
      } else {
        video.momentumScore = 0;
      }
    });

    // 6. Сортируем по momentumScore (по убыванию) и ограничиваем результат
    const sortedVideos = videosWithMetrics
      .sort((a, b) => b.momentumScore - a.momentumScore)
      .slice(0, limit);

    // 7. Формируем финальный результат
    const items: MomentumVideo[] = sortedVideos.map(video => {
      const channelInfo = channelMap.get(video.channelId);

      // Определяем категорию на основе momentumScore
      let category: "High Momentum" | "Rising" | "Normal" | "Underperforming" = "Normal";
      if (video.momentumScore > 0.5) {
        category = "High Momentum";
      } else if (video.momentumScore > 0.1) {
        category = "Rising";
      } else if (video.momentumScore < -0.3) {
        category = "Underperforming";
      }

      return {
        videoId: video.videoId,
        channelId: video.channelId,
        channelTitle: channelInfo?.title || "Unknown Channel",
        channelHandle: channelInfo?.handle,
        title: video.title,
        url: `https://www.youtube.com/watch?v=${video.videoId}`,
        publishDate: video.publishDate, // ISO 8601 string напрямую
        viewCount: video.viewCount,
        likeCount: video.likeCount,
        commentCount: video.commentCount,
        viewsPerDay: video.viewsPerDay,
        momentumScore: video.momentumScore,
        category,
      };
    });

    return {
      items,
      total: videosWithMetrics.length,
      medianViewsPerDay,
      channels,
    };
  } catch (error) {
    console.error("[MomentumQueries] Error getting top momentum videos:", error);
    throw error;
  }
}
