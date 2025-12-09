import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

interface MomentumDataPoint {
  date: string;
  avgMomentum: number;
  highMomentumCount: number;
  totalVideos: number;
}

/**
 * GET /api/dashboard/momentum-trend
 * Возвращает динамику роста momentum за 7 / 30 / 90 дней
 * Query params: ?period=7|30|90 (default: 30)
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Получаем период из query params
    const url = new URL(req.url);
    const periodParam = url.searchParams.get("period");
    const period = periodParam ? parseInt(periodParam, 10) : 30;
    const validPeriod = [7, 30, 90].includes(period) ? period : 30;

    // Получаем channelIds конкурентов
    const channelIdsResult = await db.execute({
      sql: `SELECT channelId FROM competitors WHERE userId = ?`,
      args: [userId],
    });

    const channelIds = channelIdsResult.rows.map(row => row.channelId as string);

    if (channelIds.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          period: validPeriod,
          trend: [],
          summary: {
            avgMomentumChange: 0,
            highMomentumVideosTrend: "stable",
          },
        },
      });
    }

    // Получаем все видео каналов
    const placeholders = channelIds.map(() => "?").join(",");

    const videosResult = await db.execute({
      sql: `
        SELECT
          v.videoId,
          v.channelId,
          v.viewCount,
          v.publishDate
        FROM channel_videos v
        WHERE v.channelId IN (${placeholders})
        ORDER BY v.publishDate DESC
      `,
      args: [...channelIds],
    });

    if (videosResult.rows.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          period: validPeriod,
          trend: [],
          summary: {
            avgMomentumChange: 0,
            highMomentumVideosTrend: "stable",
          },
        },
      });
    }

    // Фильтруем видео с валидной датой и рассчитываем momentum
    const now = Date.now();
    const validRows = videosResult.rows.filter(row => {
      const publishDate = row.publishDate as string;
      if (!publishDate || publishDate.startsWith("0000")) return false;
      try {
        const date = new Date(publishDate);
        return !isNaN(date.getTime());
      } catch {
        return false;
      }
    });

    const videosWithMomentum = validRows.map(row => {
      const publishDateMs = new Date(row.publishDate as string).getTime();
      const daysSincePublish = Math.max(1, (now - publishDateMs) / (1000 * 60 * 60 * 24));
      const viewsPerDay = (row.viewCount as number) / daysSincePublish;

      return {
        videoId: row.videoId as string,
        publishDate: row.publishDate as string,
        viewsPerDay,
        momentumScore: 0,
      };
    });

    // Рассчитываем медиану viewsPerDay
    const viewsPerDayValues = videosWithMomentum.map(v => v.viewsPerDay).sort((a, b) => a - b);
    const mid = Math.floor(viewsPerDayValues.length / 2);
    const medianViewsPerDay = viewsPerDayValues.length % 2 === 0
      ? (viewsPerDayValues[mid - 1] + viewsPerDayValues[mid]) / 2
      : viewsPerDayValues[mid];

    // Рассчитываем momentumScore
    if (medianViewsPerDay > 0) {
      videosWithMomentum.forEach(v => {
        v.momentumScore = (v.viewsPerDay / medianViewsPerDay) - 1;
      });
    }

    // Группируем видео по дням публикации за последние N дней
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - validPeriod);

    const trend: MomentumDataPoint[] = [];
    const dateMap = new Map<string, { momentumSum: number; highCount: number; total: number }>();

    // Инициализируем все даты периода
    for (let i = 0; i < validPeriod; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      dateMap.set(dateStr, { momentumSum: 0, highCount: 0, total: 0 });
    }

    // Заполняем данные из видео
    videosWithMomentum.forEach(v => {
      const dateStr = v.publishDate.split("T")[0];
      const entry = dateMap.get(dateStr);

      if (entry) {
        entry.total++;
        entry.momentumSum += v.momentumScore;
        if (v.momentumScore > 0.5) {
          entry.highCount++;
        }
      }
    });

    // Формируем массив тренда (от старых к новым)
    const sortedDates = Array.from(dateMap.keys()).sort();
    sortedDates.forEach(dateStr => {
      const entry = dateMap.get(dateStr)!;
      trend.push({
        date: dateStr,
        avgMomentum: entry.total > 0 ? Math.round((entry.momentumSum / entry.total) * 100) / 100 : 0,
        highMomentumCount: entry.highCount,
        totalVideos: entry.total,
      });
    });

    // Рассчитываем summary
    const firstHalf = trend.slice(0, Math.floor(trend.length / 2));
    const secondHalf = trend.slice(Math.floor(trend.length / 2));

    const firstHalfAvg = firstHalf.length > 0
      ? firstHalf.reduce((sum, d) => sum + d.highMomentumCount, 0) / firstHalf.length
      : 0;
    const secondHalfAvg = secondHalf.length > 0
      ? secondHalf.reduce((sum, d) => sum + d.highMomentumCount, 0) / secondHalf.length
      : 0;

    let highMomentumVideosTrend: "up" | "down" | "stable" = "stable";
    if (secondHalfAvg > firstHalfAvg * 1.1) {
      highMomentumVideosTrend = "up";
    } else if (secondHalfAvg < firstHalfAvg * 0.9) {
      highMomentumVideosTrend = "down";
    }

    const avgMomentumChange = trend.length > 0
      ? trend[trend.length - 1].avgMomentum - trend[0].avgMomentum
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        period: validPeriod,
        trend,
        summary: {
          avgMomentumChange: Math.round(avgMomentumChange * 100) / 100,
          highMomentumVideosTrend,
          totalHighMomentumVideos: videosWithMomentum.filter(v => v.momentumScore > 0.5).length,
          medianViewsPerDay: Math.round(medianViewsPerDay),
        },
      },
    });
  } catch (error) {
    console.error("[Dashboard MomentumTrend] Error:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to fetch momentum trend" },
      { status: 500 }
    );
  }
}
