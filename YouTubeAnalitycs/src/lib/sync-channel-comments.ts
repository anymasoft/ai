/**
 * Синхронизация комментариев к TOP-12 видео канала в БД
 *
 * Правила:
 * 1. Берёт TOP-12 видео из channel_videos
 * 2. Для каждого видео получает комментарии через ScrapeCreators
 * 3. Сохраняет комментарии в глобальную таблицу channel_comments
 *
 * Комментарии сохраняются ГЛОБАЛЬНО (не привязаны к пользователю)
 */

import { createClient } from "@libsql/client";
import { getYoutubeVideoComments } from "@/lib/scrapecreators";

interface Comment {
  videoId: string;
  channelId: string;
  author: string;
  text: string;
  likeCountInt: number;
  publishedAt: string | null;
}

const MAX_COMMENTS_PER_VIDEO = 30;
const RETRY_DELAYS = [200, 400, 800];

/**
 * Получает комментарии для одного видео с retry
 */
async function fetchCommentsWithRetry(
  videoId: string,
  limit: number = MAX_COMMENTS_PER_VIDEO
): Promise<Array<{ author: string; text: string; likes: number; publishedAt?: string }>> {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

  for (let attempt = 0; attempt < RETRY_DELAYS.length; attempt++) {
    try {
      const result = await getYoutubeVideoComments({
        url: videoUrl,
        maxComments: limit,
      });

      console.log(
        `[SyncComments] ${videoId}: получено ${result.comments.length} комментариев (попытка ${attempt + 1})`
      );

      return result.comments || [];
    } catch (err) {
      console.warn(
        `[SyncComments] ${videoId}: ошибка (попытка ${attempt + 1}):`,
        err instanceof Error ? err.message : err
      );
    }

    if (attempt < RETRY_DELAYS.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS[attempt]));
    }
  }

  console.warn(`[SyncComments] ${videoId}: не удалось получить комментарии после 3 попыток`);
  return [];
}

/**
 * Синхронизирует комментарии для TOP-12 видео канала
 *
 * @param channelId YouTube Channel ID (строка, например UCxxxxxx)
 * @returns { success: boolean, totalComments: number }
 */
export async function syncChannelComments(
  channelId: string
): Promise<{ success: boolean; totalComments: number }> {
  const dbPath = process.env.DATABASE_URL || "file:sqlite.db";
  const client = createClient({
    url: dbPath.startsWith("file:") ? dbPath : `file:${dbPath}`,
  });

  try {
    console.log(`[SyncComments] Начало синхронизации комментариев для channelId: ${channelId}`);

    // ШАГ 1: Получаем TOP-12 видео для этого канала
    const videosResult = await client.execute({
      sql: "SELECT videoId FROM channel_videos WHERE channelId = ? ORDER BY viewCountInt DESC LIMIT 12",
      args: [channelId],
    });

    const videoIds = videosResult.rows.map((v) => v.videoId as string);

    if (videoIds.length === 0) {
      console.warn(`[SyncComments] Видео не найдены для channelId: ${channelId}`);
      client.close();
      return { success: true, totalComments: 0 };
    }

    console.log(
      `[SyncComments] Найдено ${videoIds.length} видео для синхронизации комментариев`
    );

    // ШАГ 2: Проверяем, есть ли уже комментарии в БД
    const existingCommentsResult = await client.execute({
      sql: "SELECT COUNT(*) as count FROM channel_comments WHERE channelId = ?",
      args: [channelId],
    });

    const existingCount = Number(existingCommentsResult.rows[0]?.count) || 0;

    if (existingCount > 0) {
      console.log(
        `[SyncComments] В БД уже есть ${existingCount} комментариев для канала, используем кеш`
      );
      client.close();
      return { success: true, totalComments: existingCount };
    }

    console.log(`[SyncComments] Комментарии отсутствуют, загружаем с API...`);

    // ШАГ 3: Получаем комментарии для каждого видео
    let totalComments = 0;
    const now = Date.now();

    for (const videoId of videoIds) {
      try {
        const comments = await fetchCommentsWithRetry(videoId, MAX_COMMENTS_PER_VIDEO);

        if (comments.length === 0) {
          console.log(`[SyncComments] Нет комментариев для видео ${videoId}`);
          continue;
        }

        // Сохраняем комментарии в БД
        for (const comment of comments) {
          try {
            await client.execute({
              sql: `INSERT INTO channel_comments (videoId, channelId, author, text, likeCountInt, publishedAt, fetchedAt)
                    VALUES (?, ?, ?, ?, ?, ?, ?)`,
              args: [
                videoId,
                channelId,
                String(comment.author || "Unknown").trim() || "Unknown",
                String(comment.text || "").trim(),
                Number(comment.likes) || 0,
                comment.publishedAt ? String(comment.publishedAt) : null,
                now,
              ],
            });
            totalComments++;
          } catch (insertErr) {
            // Игнорируем UNIQUE constraint ошибки (дублирующиеся комментарии)
            if (
              insertErr instanceof Error &&
              insertErr.message.includes("UNIQUE")
            ) {
              continue;
            }
            console.warn(`[SyncComments] Ошибка при сохранении комментария:`, insertErr);
          }
        }

        console.log(
          `[SyncComments] Сохранено ${comments.length} комментариев для видео ${videoId}`
        );
      } catch (videoErr) {
        console.error(
          `[SyncComments] Ошибка при обработке видео ${videoId}:`,
          videoErr instanceof Error ? videoErr.message : videoErr
        );
      }
    }

    console.log(`[SyncComments] Синхронизация завершена: сохранено ${totalComments} комментариев`);

    client.close();
    return { success: true, totalComments };
  } catch (error) {
    client.close();
    console.error("[SyncComments] Критическая ошибка:", error);
    return { success: false, totalComments: 0 };
  }
}
