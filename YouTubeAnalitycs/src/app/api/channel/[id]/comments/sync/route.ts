import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, competitors, channelVideos, videoComments } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import { getYoutubeVideoComments } from "@/lib/scrapecreators";

/**
 * POST /api/channel/[id]/comments/sync
 * Синхронизирует комментарии для топ видео канала через /v1/youtube/video/comments
 */
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    // Проверка аутентификации
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Получаем ID канала из параметров URL
    const { id } = await context.params;
    const competitorId = parseInt(id, 10);

    if (!Number.isFinite(competitorId) || competitorId <= 0) {
      return NextResponse.json(
        { error: "Invalid competitor ID" },
        { status: 400 }
      );
    }

    console.log(`[CommentsSync] Запрос синхронизации для competitor ID: ${competitorId}`);

    // Получаем данные канала из БД
    const competitor = await db
      .select()
      .from(competitors)
      .where(
        and(
          eq(competitors.id, competitorId),
          eq(competitors.userId, session.user.id)
        )
      )
      .get();

    // Проверяем что канал существует и принадлежит пользователю
    if (!competitor) {
      return NextResponse.json(
        { error: "Competitor not found or access denied" },
        { status: 404 }
      );
    }

    console.log(`[CommentsSync] Канал найден: ${competitor.title}`);

    // Получаем топ 15 видео канала по просмотрам
    const videos = await db
      .select()
      .from(channelVideos)
      .where(eq(channelVideos.channelId, competitor.channelId))
      .orderBy(desc(channelVideos.viewCount))
      .limit(15)
      .all();

    if (videos.length === 0) {
      return NextResponse.json(
        { error: "No videos found. Please sync videos first." },
        { status: 400 }
      );
    }

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
        const existingComments = await db
          .select()
          .from(videoComments)
          .where(eq(videoComments.videoId, video.videoId))
          .all();

        if (existingComments.length > 0) {
          // Проверяем, что хотя бы один комментарий свежий
          const hasRecentComments = existingComments.some(
            (comment) => comment.fetchedAt > sevenDaysAgo
          );

          if (hasRecentComments) {
            console.log(
              `[CommentsSync] Видео ${video.videoId} уже имеет свежие комментарии (skip)`
            );
            skipped++;
            continue;
          }
        }

        // Формируем URL видео
        const videoUrl = `https://www.youtube.com/watch?v=${video.videoId}`;

        console.log(`[CommentsSync] Синхронизация комментариев для: ${video.videoId}`);

        // Получаем комментарии через ScrapeCreators (топ 300)
        const result = await getYoutubeVideoComments({
          url: videoUrl,
          order: "top",
          maxComments: 300,
        });

        console.log(
          `[CommentsSync] Получено ${result.comments.length} комментариев для видео ${video.videoId}`
        );

        // Сохраняем комментарии в БД
        for (const comment of result.comments) {
          try {
            // Проверяем, существует ли уже такой комментарий
            const existing = await db
              .select()
              .from(videoComments)
              .where(eq(videoComments.commentId, comment.id))
              .get();

            if (existing) {
              // Обновляем существующий комментарий
              await db
                .update(videoComments)
                .set({
                  content: comment.content,
                  publishedTime: comment.publishedTime,
                  replyLevel: comment.replyLevel,
                  likes: comment.likes,
                  replies: comment.replies,
                  authorName: comment.authorName,
                  authorChannelId: comment.authorChannelId,
                  isVerified: comment.isVerified,
                  isCreator: comment.isCreator,
                  fetchedAt: Date.now(),
                })
                .where(eq(videoComments.commentId, comment.id))
                .run();
            } else {
              // Создаём новый комментарий
              await db
                .insert(videoComments)
                .values({
                  videoId: video.videoId,
                  commentId: comment.id,
                  content: comment.content,
                  publishedTime: comment.publishedTime,
                  replyLevel: comment.replyLevel,
                  likes: comment.likes,
                  replies: comment.replies,
                  authorName: comment.authorName,
                  authorChannelId: comment.authorChannelId,
                  isVerified: comment.isVerified,
                  isCreator: comment.isCreator,
                  fetchedAt: Date.now(),
                })
                .run();
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
        console.log(`[CommentsSync] Видео ${video.videoId} синхронизировано успешно`);

        // Небольшая задержка между запросами (rate limiting)
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error: any) {
        console.error(`[CommentsSync] Ошибка синхронизации видео ${video.videoId}:`, error);

        // Если закончились кредиты - прекращаем синхронизацию
        if (error.code === "INSUFFICIENT_CREDITS" || error.status === 402) {
          console.log(`[CommentsSync] Прекращение синхронизации: закончились кредиты ScrapeCreators API`);

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
