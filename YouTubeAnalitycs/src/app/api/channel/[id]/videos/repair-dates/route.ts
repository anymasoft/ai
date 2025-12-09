import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createClient } from "@libsql/client";
import { getYoutubeVideoDetails } from "@/lib/scrapecreators";

/**
 * POST /api/channel/[id]/videos/repair-dates
 * Исправляет видео с publishDate = null
 * Запрашивает даты только для видео без publishDate
 *
 * Это "ремонтный" endpoint - используйте его после основной синхронизации
 * если остались видео без дат
 */

const LOG_PREFIX = {
  REPAIR: "[RepairDates]",
  API: "[API→]",
  DB: "[DB]",
  DATE: "[DATE]",
  SUCCESS: "[✓]",
  FAIL: "[✗]",
  RETRY: "[RETRY]",
};

/**
 * Получает publishDate для видео с retry
 */
async function fetchPublishDateWithRetry(
  videoId: string,
  maxRetries: number = 3
): Promise<string | null> {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`${LOG_PREFIX.API} ${LOG_PREFIX.RETRY} Попытка ${attempt}/${maxRetries} для ${videoId}`);

      const details = await getYoutubeVideoDetails(videoUrl);

      if (details.publishDate) {
        const parsedDate = new Date(details.publishDate);
        const isValidDate = !isNaN(parsedDate.getTime());
        const isNotFuture = parsedDate <= new Date();

        if (isValidDate && isNotFuture) {
          console.log(`${LOG_PREFIX.DATE} ${LOG_PREFIX.SUCCESS} ${videoId}: ${details.publishDate}`);
          return details.publishDate;
        } else {
          console.warn(`${LOG_PREFIX.DATE} ${LOG_PREFIX.FAIL} ${videoId}: невалидная дата ${details.publishDate}`);
          return null;
        }
      } else {
        console.warn(`${LOG_PREFIX.API} ${LOG_PREFIX.FAIL} ${videoId}: API не вернул publishDate`);
        lastError = new Error("API не вернул publishDate");
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`${LOG_PREFIX.API} ${LOG_PREFIX.FAIL} ${videoId}: попытка ${attempt} - ${lastError.message}`);

      const isRateLimit = lastError.message.includes("rate limit") || lastError.message.includes("429");

      if (attempt < maxRetries) {
        const baseDelay = isRateLimit ? 5000 : 2000;
        const delay = baseDelay * Math.pow(2, attempt - 1);
        console.log(`${LOG_PREFIX.RETRY} Ожидание ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  console.error(`${LOG_PREFIX.DATE} ${LOG_PREFIX.FAIL} ${videoId}: не удалось после ${maxRetries} попыток`);
  return null;
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const competitorId = parseInt(id, 10);

    if (!Number.isFinite(competitorId) || competitorId <= 0) {
      client.close();
      return NextResponse.json({ error: "Invalid competitor ID" }, { status: 400 });
    }

    console.log(`${LOG_PREFIX.REPAIR} ========== НАЧАЛО РЕМОНТА ДАТ ==========`);
    console.log(`${LOG_PREFIX.REPAIR} Competitor ID: ${competitorId}`);

    // Получаем канал
    const competitorResult = await client.execute({
      sql: "SELECT * FROM competitors WHERE id = ? AND userId = ?",
      args: [competitorId, session.user.id],
    });

    if (competitorResult.rows.length === 0) {
      client.close();
      return NextResponse.json({ error: "Competitor not found" }, { status: 404 });
    }

    const competitor = competitorResult.rows[0];
    console.log(`${LOG_PREFIX.REPAIR} Канал: ${competitor.title}`);

    // Получаем видео без publishDate
    const videosWithoutDateResult = await client.execute({
      sql: `SELECT id, videoId, title FROM channel_videos
            WHERE channelId = ? AND (publishDate IS NULL OR publishDate = '')
            ORDER BY fetchedAt DESC`,
      args: [competitor.channelId],
    });

    const videosToRepair = videosWithoutDateResult.rows;

    if (videosToRepair.length === 0) {
      console.log(`${LOG_PREFIX.REPAIR} ${LOG_PREFIX.SUCCESS} Все видео уже имеют publishDate!`);
      client.close();
      return NextResponse.json({
        status: "ok",
        message: "Все видео уже имеют publishDate",
        repaired: 0,
        failed: 0,
        total: 0,
      });
    }

    console.log(`${LOG_PREFIX.REPAIR} Найдено ${videosToRepair.length} видео без publishDate`);

    let repaired = 0;
    let failed = 0;

    for (const video of videosToRepair) {
      const videoId = video.videoId as string;
      const title = (video.title as string || "").slice(0, 50);

      console.log(`${LOG_PREFIX.REPAIR} Обработка: "${title}..." (${videoId})`);

      const publishDate = await fetchPublishDateWithRetry(videoId, 3);

      if (publishDate) {
        await client.execute({
          sql: "UPDATE channel_videos SET publishDate = ? WHERE id = ?",
          args: [publishDate, video.id],
        });

        console.log(`${LOG_PREFIX.DB} ${LOG_PREFIX.SUCCESS} ${videoId}: publishDate = ${publishDate}`);
        repaired++;
      } else {
        console.log(`${LOG_PREFIX.DB} ${LOG_PREFIX.FAIL} ${videoId}: не удалось получить дату`);
        failed++;
      }

      // Задержка между запросами
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Финальная проверка
    const remainingResult = await client.execute({
      sql: "SELECT COUNT(*) as count FROM channel_videos WHERE channelId = ? AND (publishDate IS NULL OR publishDate = '')",
      args: [competitor.channelId],
    });

    const remaining = Number(remainingResult.rows[0]?.count || 0);

    console.log(`${LOG_PREFIX.REPAIR} ========== ИТОГИ РЕМОНТА ==========`);
    console.log(`${LOG_PREFIX.REPAIR} Исправлено: ${repaired}`);
    console.log(`${LOG_PREFIX.REPAIR} Не удалось: ${failed}`);
    console.log(`${LOG_PREFIX.REPAIR} Осталось без даты: ${remaining}`);

    client.close();

    return NextResponse.json({
      status: "ok",
      repaired,
      failed,
      total: videosToRepair.length,
      remaining,
    });
  } catch (error) {
    client.close();
    console.error(`${LOG_PREFIX.REPAIR} Ошибка:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Repair failed" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/channel/[id]/videos/repair-dates
 * Возвращает список видео без publishDate
 */
export async function GET(
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const competitorId = parseInt(id, 10);

    if (!Number.isFinite(competitorId) || competitorId <= 0) {
      client.close();
      return NextResponse.json({ error: "Invalid competitor ID" }, { status: 400 });
    }

    // Получаем канал
    const competitorResult = await client.execute({
      sql: "SELECT channelId, title FROM competitors WHERE id = ? AND userId = ?",
      args: [competitorId, session.user.id],
    });

    if (competitorResult.rows.length === 0) {
      client.close();
      return NextResponse.json({ error: "Competitor not found" }, { status: 404 });
    }

    const competitor = competitorResult.rows[0];

    // Получаем видео без publishDate
    const videosWithoutDateResult = await client.execute({
      sql: `SELECT videoId, title, viewCount, fetchedAt FROM channel_videos
            WHERE channelId = ? AND (publishDate IS NULL OR publishDate = '')
            ORDER BY viewCount DESC`,
      args: [competitor.channelId],
    });

    // Общее количество видео
    const totalResult = await client.execute({
      sql: "SELECT COUNT(*) as count FROM channel_videos WHERE channelId = ?",
      args: [competitor.channelId],
    });

    client.close();

    return NextResponse.json({
      channelTitle: competitor.title,
      videosWithoutDate: videosWithoutDateResult.rows.map(row => ({
        videoId: row.videoId,
        title: row.title,
        viewCount: row.viewCount,
        fetchedAt: row.fetchedAt,
      })),
      countWithoutDate: videosWithoutDateResult.rows.length,
      totalVideos: Number(totalResult.rows[0]?.count || 0),
    });
  } catch (error) {
    client.close();
    console.error("[RepairDates] GET error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get videos" },
      { status: 500 }
    );
  }
}
