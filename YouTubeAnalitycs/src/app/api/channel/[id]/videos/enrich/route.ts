import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, competitors, channelVideos, videoDetails, audienceInsights } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import { getYoutubeVideoDetails } from "@/lib/scrapecreators";

/**
 * POST /api/channel/[id]/videos/enrich
 * Обогащает топ видео канала детальными данными через /v1/youtube/video
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

    console.log(`[Enrich] Запрос обогащения для competitor ID: ${competitorId}`);

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

    console.log(`[Enrich] Канал найден: ${competitor.title}`);

    // Получаем топ 30 видео канала по просмотрам
    const videos = await db
      .select()
      .from(channelVideos)
      .where(eq(channelVideos.channelId, competitor.channelId))
      .orderBy(desc(channelVideos.viewCount))
      .limit(30)
      .all();

    if (videos.length === 0) {
      return NextResponse.json(
        { error: "No videos found. Please sync videos first." },
        { status: 400 }
      );
    }

    console.log(`[Enrich] Найдено ${videos.length} видео для обогащения`);

    // Обогащаем каждое видео
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let enriched = 0;
    let skipped = 0;
    let errors = 0;

    for (const video of videos) {
      try {
        // Проверяем, есть ли уже детальные данные и не устарели ли они
        const existingDetails = await db
          .select()
          .from(videoDetails)
          .where(eq(videoDetails.videoId, video.videoId))
          .get();

        if (existingDetails && existingDetails.updatedAt > sevenDaysAgo) {
          console.log(`[Enrich] Видео ${video.videoId} уже обогащено (skip)`);
          skipped++;
          continue;
        }

        // Формируем URL видео
        const videoUrl = `https://www.youtube.com/watch?v=${video.videoId}`;

        console.log(`[Enrich] Обогащение видео: ${video.videoId}`);

        // Получаем детальные данные через ScrapeCreators
        const details = await getYoutubeVideoDetails(videoUrl);

        // Обрезаем транскрипт до 4000 символов
        const transcriptShort = details.transcriptText
          ? details.transcriptText.slice(0, 4000)
          : null;

        // Сохраняем или обновляем в БД
        if (existingDetails) {
          // Обновляем существующую запись
          await db
            .update(videoDetails)
            .set({
              url: videoUrl,
              likeCount: details.likeCount,
              commentCount: details.commentCount,
              viewCount: details.viewCount,
              durationMs: details.durationMs || null,
              keywordsJson: details.keywords
                ? JSON.stringify(details.keywords)
                : null,
              transcriptShort,
              updatedAt: Date.now(),
            })
            .where(eq(videoDetails.videoId, video.videoId))
            .run();
        } else {
          // Создаём новую запись
          await db
            .insert(videoDetails)
            .values({
              videoId: video.videoId,
              url: videoUrl,
              likeCount: details.likeCount,
              commentCount: details.commentCount,
              viewCount: details.viewCount,
              durationMs: details.durationMs || null,
              keywordsJson: details.keywords
                ? JSON.stringify(details.keywords)
                : null,
              transcriptShort,
              updatedAt: Date.now(),
            })
            .run();
        }

        enriched++;
        console.log(`[Enrich] Видео ${video.videoId} обогащено успешно`);

        // Небольшая задержка между запросами (rate limiting)
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`[Enrich] Ошибка обогащения видео ${video.videoId}:`, error);
        errors++;
        // Продолжаем обработку остальных видео
      }
    }

    console.log(
      `[Enrich] Завершено. Обогащено: ${enriched}, пропущено: ${skipped}, ошибок: ${errors}`
    );

    // Инвалидируем кэш audience insights если обогатили хотя бы 1 видео
    if (enriched > 0) {
      try {
        await db
          .delete(audienceInsights)
          .where(eq(audienceInsights.channelId, competitor.channelId))
          .run();
        console.log(`[Enrich] Инвалидирован кэш audience insights для канала ${competitor.channelId}`);
      } catch (cacheError) {
        console.error(`[Enrich] Ошибка инвалидации кэша:`, cacheError);
        // Не критично, продолжаем
      }
    }

    return NextResponse.json(
      {
        success: true,
        enriched,
        skipped,
        errors,
        total: videos.length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Enrich] Ошибка:", error);

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to enrich videos" },
      { status: 500 }
    );
  }
}
