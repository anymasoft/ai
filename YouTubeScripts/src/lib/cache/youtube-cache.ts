import { db } from '../db';
import type { ChannelData, VideoData } from '../scrapecreators';

/**
 * Типизация для кешированных данных видео
 * Расширяет VideoData с дополнительными полями из videos_cache
 */
interface CachedVideoDetails {
  videoId: string;
  title: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  publishDate: string | null;
  durationMs: number | null;
  keywords: string[] | null;
  transcriptText: string | null;
}

/**
 * Получает базовую информацию о канале из глобального кеша
 * @param channelId - ID канала
 * @returns Данные канала или null если нет в кеше
 */
export async function getCachedChannel(channelId: string): Promise<ChannelData | null> {
  try {
    const client = await db;
    const result = await client.execute(
      `SELECT channelId, title, handle, avatarUrl, subscriberCount, videoCount, viewCount
       FROM channels_cache
       WHERE channelId = ?`,
      [channelId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0] as any;
    return {
      channelId: row.channelId,
      title: row.title,
      handle: row.handle || '',
      avatarUrl: row.avatarUrl || null,
      subscriberCount: row.subscriberCount || 0,
      videoCount: row.videoCount || 0,
      viewCount: row.viewCount || 0,
    };
  } catch (error) {
    console.error(`[Cache] Error getting cached channel ${channelId}:`, error);
    return null;
  }
}

/**
 * Сохраняет информацию о канале в глобальный кеш
 * @param channel - Данные канала для сохранения
 */
export async function saveChannelToCache(channel: ChannelData): Promise<void> {
  try {
    const client = await db;
    const now = Date.now();

    await client.execute(
      `INSERT OR REPLACE INTO channels_cache
       (channelId, title, handle, avatarUrl, subscriberCount, videoCount, viewCount, lastUpdated)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        channel.channelId,
        channel.title,
        channel.handle,
        channel.avatarUrl || null,
        channel.subscriberCount,
        channel.videoCount,
        channel.viewCount,
        now,
      ]
    );

    console.log(`[Cache] Channel ${channel.channelId} saved to cache`);
  } catch (error) {
    console.error(`[Cache] Error saving channel ${channel.channelId}:`, error);
    throw error;
  }
}

/**
 * Получает список всех видео канала из глобального кеша
 * @param channelId - ID канала
 * @returns Массив видео
 */
export async function getCachedChannelVideos(channelId: string): Promise<VideoData[]> {
  try {
    const client = await db;
    const result = await client.execute(
      `SELECT videoId, title, thumbnailUrl, viewCount, likeCount, commentCount, publishDate, duration
       FROM channel_videos_cache
       WHERE channelId = ?
       ORDER BY lastUpdated DESC`,
      [channelId]
    );

    return result.rows.map((row: any) => ({
      videoId: row.videoId,
      title: row.title,
      thumbnailUrl: row.thumbnailUrl || null,
      viewCount: row.viewCount || 0,
      likeCount: row.likeCount || 0,
      commentCount: row.commentCount || 0,
      publishDate: row.publishDate || null,
      duration: row.duration || undefined,
    }));
  } catch (error) {
    console.error(`[Cache] Error getting cached videos for channel ${channelId}:`, error);
    return [];
  }
}

/**
 * Сохраняет список видео канала в глобальный кеш
 * Использует upsert (INSERT OR REPLACE) для обновления существующих видео
 * @param channelId - ID канала
 * @param videos - Массив видео для сохранения
 */
export async function saveChannelVideosToCache(
  channelId: string,
  videos: VideoData[]
): Promise<void> {
  try {
    const client = await db;
    const now = Date.now();

    for (const video of videos) {
      await client.execute(
        `INSERT OR REPLACE INTO channel_videos_cache
         (channelId, videoId, title, thumbnailUrl, viewCount, likeCount, commentCount, publishDate, duration, lastUpdated)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          channelId,
          video.videoId,
          video.title,
          video.thumbnailUrl || null,
          video.viewCount,
          video.likeCount,
          video.commentCount,
          video.publishDate || null,
          video.duration || null,
          now,
        ]
      );
    }

    console.log(`[Cache] Saved ${videos.length} videos for channel ${channelId}`);
  } catch (error) {
    console.error(`[Cache] Error saving videos for channel ${channelId}:`, error);
    throw error;
  }
}

/**
 * Получает детальную информацию о видео из глобального кеша
 * @param videoId - ID видео
 * @returns Детальные данные видео или null если нет в кеше
 */
export async function getCachedVideo(videoId: string): Promise<CachedVideoDetails | null> {
  try {
    const client = await db;
    const result = await client.execute(
      `SELECT videoId, title, viewCount, likeCount, commentCount, publishDate, durationMs, keywords, transcriptText
       FROM videos_cache
       WHERE videoId = ?`,
      [videoId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0] as any;
    let keywords: string[] | null = null;

    // Десериализуем keywords из JSON если они присутствуют
    if (row.keywords) {
      try {
        keywords = JSON.parse(row.keywords);
      } catch (e) {
        console.warn(`[Cache] Failed to parse keywords for video ${videoId}:`, e);
        keywords = null;
      }
    }

    return {
      videoId: row.videoId,
      title: row.title,
      viewCount: row.viewCount || 0,
      likeCount: row.likeCount || 0,
      commentCount: row.commentCount || 0,
      publishDate: row.publishDate || null,
      durationMs: row.durationMs || null,
      keywords,
      transcriptText: row.transcriptText || null,
    };
  } catch (error) {
    console.error(`[Cache] Error getting cached video ${videoId}:`, error);
    return null;
  }
}

/**
 * Сохраняет детальную информацию о видео в глобальный кеш
 * @param details - Детальные данные видео для сохранения
 */
export async function saveVideoDetailsToCache(details: {
  videoId: string;
  title: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  publishDate?: string | null;
  durationMs?: number | null;
  keywords?: string[] | null;
  transcriptText?: string | null;
}): Promise<void> {
  try {
    const client = await db;
    const now = Date.now();

    // Сериализуем keywords в JSON
    let keywordsJson: string | null = null;
    if (details.keywords && Array.isArray(details.keywords)) {
      try {
        keywordsJson = JSON.stringify(details.keywords);
      } catch (e) {
        console.warn(`[Cache] Failed to serialize keywords for video ${details.videoId}:`, e);
      }
    }

    await client.execute(
      `INSERT OR REPLACE INTO videos_cache
       (videoId, title, viewCount, likeCount, commentCount, publishDate, durationMs, keywords, transcriptText, lastUpdated)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        details.videoId,
        details.title,
        details.viewCount,
        details.likeCount,
        details.commentCount,
        details.publishDate || null,
        details.durationMs || null,
        keywordsJson,
        details.transcriptText || null,
        now,
      ]
    );

    console.log(`[Cache] Video ${details.videoId} saved to cache`);
  } catch (error) {
    console.error(`[Cache] Error saving video ${details.videoId}:`, error);
    throw error;
  }
}
