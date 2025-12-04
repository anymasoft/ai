import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createClient } from "@libsql/client";
import { getYoutubeVideoDetails } from "@/lib/scrapecreators";

/**
 * POST /api/channel/[id]/videos/enrich
 * Обогащает топ видео канала детальными данными через /v1/youtube/video
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

    console.log(`[Enrich] Запрос обогащения для competitor ID: ${competitorId}`);

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

    console.log(`[Enrich] Канал найден: ${competitor.title}`);

    // Получаем топ 30 видео канала по просмотрам
    const videosResult = await client.execute({
      sql: "SELECT * FROM channel_videos WHERE channel_id = ? ORDER BY view_count DESC LIMIT 30",
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

    console.log(`[Enrich] Найдено ${videos.length} видео для обогащения`);

    // Обогащаем каждое видео
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let enriched = 0;
    let skipped = 0;
    let errors = 0;

    for (const video of videos) {
      try {
        // Проверяем, есть ли уже детальные данные и не устарели ли они
        const existingDetailsResult = await client.execute({
          sql: "SELECT * FROM video_details WHERE video_id = ?",
          args: [video.video_id],
        });

        if (existingDetailsResult.rows.length > 0) {
          const existingDetails = existingDetailsResult.rows[0];
          if ((existingDetails.updated_at as number) > sevenDaysAgo) {
            console.log(`[Enrich] Видео ${video.video_id} уже обогащено (skip)`);
            skipped++;
            continue;
          }
        }

        // Формируем URL видео
        const videoUrl = `https://www.youtube.com/watch?v=${video.video_id}`;

        console.log(`[Enrich] Обогащение видео: ${video.video_id}`);

        // Получаем детальные данные через ScrapeCreators
        const details = await getYoutubeVideoDetails(videoUrl);

        // Обрезаем транскрипт до 4000 символов
        const transcriptShort = details.transcriptText
          ? details.transcriptText.slice(0, 4000)
          : null;

        // Сохраняем или обновляем в БД
        if (existingDetailsResult.rows.length > 0) {
          // Обновляем существующую запись
          await client.execute({
            sql: `UPDATE video_details SET
              url = ?,
              like_count = ?,
              comment_count = ?,
              view_count = ?,
              duration_ms = ?,
              keywords_json = ?,
              transcript_short = ?,
              updated_at = ?
              WHERE video_id = ?`,
            args: [
              videoUrl,
              details.likeCount,
              details.commentCount,
              details.viewCount,
              details.durationMs || null,
              details.keywords ? JSON.stringify(details.keywords) : null,
              transcriptShort,
              Date.now(),
              video.video_id,
            ],
          });
        } else {
          // Создаём новую запись
          await client.execute({
            sql: `INSERT INTO video_details (
              video_id, url, like_count, comment_count, view_count,
              duration_ms, keywords_json, transcript_short, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
              video.video_id,
              videoUrl,
              details.likeCount,
              details.commentCount,
              details.viewCount,
              details.durationMs || null,
              details.keywords ? JSON.stringify(details.keywords) : null,
              transcriptShort,
              Date.now(),
            ],
          });
        }

        enriched++;
        console.log(`[Enrich] Видео ${video.video_id} обогащено успешно`);

        // Небольшая задержка между запросами (rate limiting)
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`[Enrich] Ошибка обогащения видео ${video.video_id}:`, error);
        errors++;
        // Продолжаем обработку остальных видео
      }
    }

    console.log(
      `[Enrich] Завершено. Обогащено: ${enriched}, пропущено: ${skipped}, ошибок: ${errors}`
    );

    // Инвалидируем кэш audience insights если есть обогащённые данные
    // (либо только что обогатили, либо данные уже были)
    if (enriched > 0 || skipped > 0) {
      try {
        await client.execute({
          sql: "DELETE FROM audience_insights WHERE channel_id = ?",
          args: [competitor.channel_id],
        });
        console.log(`[Enrich] Инвалидирован кэш audience insights для канала ${competitor.channel_id}`);
      } catch (cacheError) {
        console.error(`[Enrich] Ошибка инвалидации кэша:`, cacheError);
        // Не критично, продолжаем
      }
    }

    client.close();

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
    client.close();
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
