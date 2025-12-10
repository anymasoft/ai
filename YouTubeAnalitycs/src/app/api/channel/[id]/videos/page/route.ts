import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createClient } from "@libsql/client";
import { VIDEO_PAGE_SIZE, getVideoLimitForPlan } from "@/config/limits";
import { getUserPlan } from "@/lib/user-plan";

/**
 * GET /api/channel/[id]/videos/page?page=N
 *
 * Загружает видео постранично из channel_videos таблицы.
 * Соблюдает тарифные лимиты.
 *
 * Параметры:
 * - page: номер страницы (0-based)
 *
 * Ответ:
 * {
 *   ok: true,
 *   videos: VideoData[],
 *   hasMore: boolean,
 *   totalVideos: number,
 *   page: number,
 *   maxVideos: number
 * }
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

    // Получаем параметр page из query string
    const pageParam = req.nextUrl.searchParams.get("page");
    const page = pageParam ? parseInt(pageParam, 10) : 0;

    if (!Number.isFinite(page) || page < 0) {
      client.close();
      return NextResponse.json({ error: "Invalid page parameter" }, { status: 400 });
    }

    console.log(`[VideosPage] Запрос страницы ${page} для competitor ID: ${competitorId}`);

    // Получаем данные конкурента для channelId
    const competitorResult = await client.execute({
      sql: "SELECT channelId FROM competitors WHERE id = ? AND userId = ?",
      args: [competitorId, session.user.id],
    });

    if (competitorResult.rows.length === 0) {
      client.close();
      return NextResponse.json({ error: "Competitor not found" }, { status: 404 });
    }

    const channelId = competitorResult.rows[0].channelId as string;

    // Получаем тарифный лимит пользователя
    const userPlan = getUserPlan(session);
    const maxVideos = getVideoLimitForPlan(userPlan);

    console.log(`[VideosPage] User plan: ${userPlan}, max videos: ${maxVideos}`);

    // Получаем общее количество видео в БД
    const countResult = await client.execute({
      sql: "SELECT COUNT(*) as count FROM channel_videos WHERE channelId = ?",
      args: [channelId],
    });

    const totalVideos = Number(countResult.rows[0]?.count || 0);
    console.log(`[VideosPage] Total videos in DB: ${totalVideos}`);

    // Вычисляем offset
    const offset = page * VIDEO_PAGE_SIZE;

    // Проверяем, не превышает ли уже запрошенное количество лимит
    if (offset >= maxVideos) {
      console.log(`[VideosPage] Offset ${offset} >= max videos ${maxVideos}, no more videos available`);
      client.close();
      return NextResponse.json({
        ok: true,
        videos: [],
        hasMore: false,
        totalVideos,
        page,
        maxVideos,
      });
    }

    // Получаем видео для этой страницы
    const videosResult = await client.execute({
      sql: `SELECT id, channelId, videoId, title, thumbnailUrl, viewCount, publishDate, fetchedAt
            FROM channel_videos
            WHERE channelId = ?
            ORDER BY viewCount DESC
            LIMIT ? OFFSET ?`,
      args: [channelId, VIDEO_PAGE_SIZE, offset],
    });

    const videos = videosResult.rows.map(row => ({ ...row }));

    // Определяем, есть ли ещё видео
    // hasMore = true если:
    // 1. Есть видео в следующей страничке
    // 2. AND количество загруженных видео не превышает лимит тарифа
    const nextPageStart = (page + 1) * VIDEO_PAGE_SIZE;
    const hasMore = nextPageStart < totalVideos && nextPageStart < maxVideos;

    console.log(`[VideosPage] Page ${page}: loaded ${videos.length} videos, hasMore: ${hasMore}`);

    client.close();

    return NextResponse.json({
      ok: true,
      videos,
      hasMore,
      totalVideos,
      page,
      maxVideos,
    });
  } catch (error) {
    client.close();
    console.error("[VideosPage] Ошибка:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load videos" },
      { status: 500 }
    );
  }
}
