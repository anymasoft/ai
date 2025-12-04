import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createClient } from "@libsql/client";
import { getYoutubeVideoComments } from "@/lib/scrapecreators";

/**
 * POST /api/channel/[id]/comments/sync
 * Синхронизирует комментарии для топ видео канала через /v1/youtube/video/comments
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

    // Получаем ID канала из параметров URL
    const { id } = await context.params;
    const competitorId = parseInt(id, 10);

    if (!Number.isFinite(competitorId) || competitorId <= 0) {
      client.close();
      return NextResponse.json(
        { error: "Invalid competitor ID" },
        { status: 400 }
      );
    }

    console.log(`[CommentsSync] Запрос синхронизации для competitor ID: ${competitorId}`);

    // Получаем данные канала из БД
    const competitorResult = await client.execute({
      sql: "SELECT * FROM competitors WHERE id = ? AND user_id = ?",
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

    console.log(`[CommentsSync] Канал найден: ${competitor.title}`);

    // Получаем топ 15 видео канала по просмотрам
    const videosResult = await client.execute({
      sql: "SELECT * FROM channel_videos WHERE channel_id = ? ORDER BY view_count DESC LIMIT 15",
      args: [competitor.channel_id],
    });

    if (videosResult.rows.length === 0) {
      client.close();
      return NextResponse.json(
        { error: "No videos found. Please sync videos first." },
        { status: 400 }
      );
    }

    const videos = videosResult.rows;

    console.log(`[CommentsSync] Найдено ${videos.length} видео для синхронизации комментариев`);

    // Синхронизируем комментарии для каждого видео
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let synced = 0;
    let skipped = 0;
    let errors = 0;
    let totalComments = 0;

    for (const video of videos) {
      try {
        // Проверяем, есть ли уже комментарии и не устарели ли они
        const existingCommentsResult = await client.execute({
          sql: "SELECT * FROM video_comments WHERE video_id = ?",
          args: [video.video_id],
        });

        if (existingCommentsResult.rows.length > 0) {
          // Проверяем, что хотя бы один комментарий свежий
          const hasRecentComments = existingCommentsResult.rows.some(
            (comment) => (comment.fetched_at as number) > sevenDaysAgo
          );

          if (hasRecentComments) {
            console.log(
              `[CommentsSync] Видео ${video.video_id} уже имеет свежие комментарии (skip)`
            );
            skipped++;
            continue;
          }
        }

        // Формируем URL видео
        const videoUrl = `https://www.youtube.com/watch?v=${video.video_id}`;

        console.log(`[CommentsSync] Синхронизация комментариев для: ${video.video_id}`);

        // Получаем комментарии через ScrapeCreators (топ 300)
        const result = await getYoutubeVideoComments({
          url: videoUrl,
          order: "top",
          maxComments: 300,
        });

        console.log(
          `[CommentsSync] Получено ${result.comments.length} комментариев для видео ${video.video_id}`
        );

        // Сохраняем комментарии в БД
        for (const comment of result.comments) {
          try {
            // Проверяем, существует ли уже такой комментарий
            const existingResult = await client.execute({
              sql: "SELECT * FROM video_comments WHERE comment_id = ?",
              args: [comment.id],
            });

            if (existingResult.rows.length > 0) {
              // Обновляем существующий комментарий
              await client.execute({
                sql: `UPDATE video_comments SET
                  content = ?,
                  published_time = ?,
                  reply_level = ?,
                  likes = ?,
                  replies = ?,
                  author_name = ?,
                  author_channel_id = ?,
                  is_verified = ?,
                  is_creator = ?,
                  fetched_at = ?
                  WHERE comment_id = ?`,
                args: [
                  comment.content,
                  comment.publishedTime,
                  comment.replyLevel,
                  comment.likes,
                  comment.replies,
                  comment.authorName,
                  comment.authorChannelId,
                  comment.isVerified ? 1 : 0,
                  comment.isCreator ? 1 : 0,
                  Date.now(),
                  comment.id,
                ],
              });
            } else {
              // Создаём новый комментарий
              await client.execute({
                sql: `INSERT INTO video_comments (
                  video_id, comment_id, content, published_time, reply_level,
                  likes, replies, author_name, author_channel_id, is_verified,
                  is_creator, fetched_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                args: [
                  video.video_id,
                  comment.id,
                  comment.content,
                  comment.publishedTime,
                  comment.replyLevel,
                  comment.likes,
                  comment.replies,
                  comment.authorName,
                  comment.authorChannelId,
                  comment.isVerified ? 1 : 0,
                  comment.isCreator ? 1 : 0,
                  Date.now(),
                ],
              });
            }
          } catch (commentError) {
            console.error(
              `[CommentsSync] Ошибка сохранения комментария ${comment.id}:`,
              commentError
            );
            // Продолжаем обработку остальных комментариев
          }
        }

        totalComments += result.comments.length;
        synced++;
        console.log(`[CommentsSync] Видео ${video.video_id} синхронизировано успешно`);

        // Небольшая задержка между запросами (rate limiting)
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error: any) {
        console.error(`[CommentsSync] Ошибка синхронизации видео ${video.video_id}:`, error);

        // Если закончились кредиты - прекращаем синхронизацию
        if (error.code === "INSUFFICIENT_CREDITS" || error.status === 402) {
          console.log(`[CommentsSync] Прекращение синхронизации: закончились кредиты ScrapeCreators API`);

          client.close();
          return NextResponse.json(
            {
              success: false,
              error: "Закончились кредиты ScrapeCreators API. Необходимо пополнить баланс для продолжения синхронизации.",
              synced,
              skipped,
              errors: errors + 1,
              totalComments,
              totalVideos: videos.length,
              insufficientCredits: true,
            },
            { status: 402 }
          );
        }

        errors++;
        // Продолжаем обработку остальных видео для других типов ошибок
      }
    }

    console.log(
      `[CommentsSync] Завершено. Синхронизировано видео: ${synced}, пропущено: ${skipped}, ошибок: ${errors}, всего комментариев: ${totalComments}`
    );

    client.close();

    return NextResponse.json(
      {
        success: true,
        synced,
        skipped,
        errors,
        totalComments,
        totalVideos: videos.length,
      },
      { status: 200 }
    );
  } catch (error) {
    client.close();
    console.error("[CommentsSync] Ошибка:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to sync comments" },
      { status: 500 }
    );
  }
}
