import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

interface VideoPerformance {
  videoId: string;
  title: string;
  channelId: string;
  channelTitle: string;
  thumbnailUrl: string | null;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  publishedAt: string;
  viewsPerDay: number;
  momentumScore: number;
  category: "High Momentum" | "Rising" | "Normal" | "Underperforming";
  url: string;
}

/**
 * GET /api/dashboard/video-performance
 * Возвращает топ-видео по:
 * - momentum (sortBy=momentum)
 * - viewsPerDay (sortBy=viewsPerDay)
 * - publishedAt / lastSyncedAt (sortBy=recent)
 *
 * Query params:
 * - sortBy: momentum | viewsPerDay | recent (default: momentum)
 * - limit: number (default: 10, max: 50)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Получаем параметры из query
    const url = new URL(req.url);
    const sortBy = url.searchParams.get("sortBy") || "momentum";
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10), 1), 50) : 10;

    // Получаем channelIds конкурентов с названиями каналов
    const competitorsResult = await db.execute({
      sql: `SELECT channelId, title FROM competitors WHERE userId = ?`,
      args: [userId],
    });

    if (competitorsResult.rows.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          videos: [],
          sortBy,
          limit,
          total: 0,
        },
      });
    }

    const channelIds = competitorsResult.rows.map(row => row.channelId as string);
    const channelTitleMap = new Map<string, string>();
    competitorsResult.rows.forEach(row => {
      channelTitleMap.set(row.channelId as string, row.title as string);
    });

    // Получаем все видео каналов
    const placeholders = channelIds.map(() => "?").join(",");

    const videosResult = await db.execute({
      sql: `
        SELECT
          videoId,
          channelId,
          title,
          thumbnailUrl,
          viewCount,
          likeCount,
          commentCount,
          publishedAt
        FROM channel_videos
        WHERE channelId IN (${placeholders})
        ORDER BY publishedAt DESC
      `,
      args: [...channelIds],
    });

    if (videosResult.rows.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          videos: [],
          sortBy,
          limit,
          total: 0,
        },
      });
    }

    // Фильтруем видео с валидной датой и рассчитываем momentum
    const now = Date.now();
    const validRows = videosResult.rows.filter(row => {
      const publishedAt = row.publishedAt as string;
      if (!publishedAt || publishedAt.startsWith("0000")) return false;
      try {
        const date = new Date(publishedAt);
        return !isNaN(date.getTime());
      } catch {
        return false;
      }
    });

    const videosWithMetrics: VideoPerformance[] = validRows.map(row => {
      const publishedAt = new Date(row.publishedAt as string).getTime();
      const daysSincePublish = Math.max(1, (now - publishedAt) / (1000 * 60 * 60 * 24));
      const viewsPerDay = (row.viewCount as number) / daysSincePublish;
      const channelId = row.channelId as string;

      return {
        videoId: row.videoId as string,
        title: row.title as string,
        channelId,
        channelTitle: channelTitleMap.get(channelId) || "Unknown",
        thumbnailUrl: row.thumbnailUrl as string | null,
        viewCount: row.viewCount as number,
        likeCount: row.likeCount as number,
        commentCount: row.commentCount as number,
        publishedAt: row.publishedAt as string,
        viewsPerDay,
        momentumScore: 0,
        category: "Normal" as const,
        url: `https://www.youtube.com/watch?v=${row.videoId}`,
      };
    });

    // Рассчитываем медиану viewsPerDay
    const viewsPerDayValues = videosWithMetrics.map(v => v.viewsPerDay).sort((a, b) => a - b);
    const mid = Math.floor(viewsPerDayValues.length / 2);
    const medianViewsPerDay = viewsPerDayValues.length % 2 === 0
      ? (viewsPerDayValues[mid - 1] + viewsPerDayValues[mid]) / 2
      : viewsPerDayValues[mid];

    // Рассчитываем momentumScore и категорию
    if (medianViewsPerDay > 0) {
      videosWithMetrics.forEach(v => {
        v.momentumScore = (v.viewsPerDay / medianViewsPerDay) - 1;

        if (v.momentumScore > 0.5) {
          v.category = "High Momentum";
        } else if (v.momentumScore > 0.1) {
          v.category = "Rising";
        } else if (v.momentumScore < -0.3) {
          v.category = "Underperforming";
        } else {
          v.category = "Normal";
        }

        // Округляем значения для клиента
        v.viewsPerDay = Math.round(v.viewsPerDay);
        v.momentumScore = Math.round(v.momentumScore * 100) / 100;
      });
    }

    // Сортируем по выбранному критерию
    let sortedVideos: VideoPerformance[];

    switch (sortBy) {
      case "viewsPerDay":
        sortedVideos = [...videosWithMetrics].sort((a, b) => b.viewsPerDay - a.viewsPerDay);
        break;
      case "recent":
        sortedVideos = [...videosWithMetrics].sort(
          (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
        );
        break;
      case "momentum":
      default:
        sortedVideos = [...videosWithMetrics].sort((a, b) => b.momentumScore - a.momentumScore);
        break;
    }

    // Ограничиваем результат
    const resultVideos = sortedVideos.slice(0, limit);

    return NextResponse.json({
      success: true,
      data: {
        videos: resultVideos,
        sortBy,
        limit,
        total: videosWithMetrics.length,
        medianViewsPerDay: Math.round(medianViewsPerDay),
        stats: {
          highMomentum: videosWithMetrics.filter(v => v.category === "High Momentum").length,
          rising: videosWithMetrics.filter(v => v.category === "Rising").length,
          normal: videosWithMetrics.filter(v => v.category === "Normal").length,
          underperforming: videosWithMetrics.filter(v => v.category === "Underperforming").length,
        },
      },
    });
  } catch (error) {
    console.error("[Dashboard VideoPerformance] Error:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to fetch video performance" },
      { status: 500 }
    );
  }
}
