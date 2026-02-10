import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/dashboard/kpi
 * Возвращает ключевые метрики для Dashboard:
 * - totalCompetitors
 * - totalSubscribers
 * - totalVideos
 * - totalViews
 * - avgMomentum
 * - topMomentumVideo
 * - totalScriptsGenerated
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // 1. Получаем агрегированные данные по конкурентам (один запрос)
    const competitorsResult = await db.execute({
      sql: `
        SELECT
          COUNT(*) as totalCompetitors,
          COALESCE(SUM(subscriberCount), 0) as totalSubscribers,
          COALESCE(SUM(videoCount), 0) as totalVideos,
          COALESCE(SUM(viewCount), 0) as totalViews
        FROM competitors
        WHERE userId = ?
      `,
      args: [userId],
    });

    const competitorStats = competitorsResult.rows[0] || {
      totalCompetitors: 0,
      totalSubscribers: 0,
      totalVideos: 0,
      totalViews: 0,
    };

    // 2. Получаем количество сгенерированных сценариев
    const scriptsResult = await db.execute({
      sql: `SELECT COUNT(*) as count FROM generated_scripts WHERE userId = ?`,
      args: [userId],
    });

    const totalScriptsGenerated = Number(scriptsResult.rows[0]?.count) || 0;

    // 3. Получаем channelIds конкурентов для расчета momentum
    const channelIdsResult = await db.execute({
      sql: `SELECT channelId FROM competitors WHERE userId = ?`,
      args: [userId],
    });

    const channelIds = channelIdsResult.rows.map(row => row.channelId as string);

    let avgMomentum = 0;
    let topMomentumVideo: {
      videoId: string;
      title: string;
      channelTitle: string;
      viewsPerDay: number;
      momentumScore: number;
      url: string;
    } | null = null;

    if (channelIds.length > 0) {
      // 4. Получаем все видео каналов и рассчитываем momentum
      const placeholders = channelIds.map(() => "?").join(",");

      const videosResult = await db.execute({
        sql: `
          SELECT
            v.videoId,
            v.channelId,
            v.title,
            v.viewCountInt,
            v.publishDate,
            c.title as channelTitle
          FROM channel_videos v
          JOIN competitors c ON v.channelId = c.channelId AND c.userId = ?
          WHERE v.channelId IN (${placeholders})
          ORDER BY v.viewCountInt DESC
        `,
        args: [userId, ...channelIds],
      });

      if (videosResult.rows.length > 0) {
        // Фильтруем видео с валидной датой
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

        if (validRows.length > 0) {
          // Рассчитываем viewsPerDay для каждого видео
          const now = Date.now();
          const videosWithMomentum = validRows.map(row => {
            const publishDateMs = new Date(row.publishDate as string).getTime();
            const daysSincePublish = Math.max(1, (now - publishDateMs) / (1000 * 60 * 60 * 24));
            const viewsPerDay = (row.viewCountInt as number) / daysSincePublish;

            return {
              videoId: row.videoId as string,
              title: row.title as string,
              channelTitle: row.channelTitle as string,
              viewCount: row.viewCountInt as number,
              viewsPerDay,
              momentumScore: 0, // Будет рассчитан после определения медианы
            };
          });

        // Рассчитываем медиану viewsPerDay
        const viewsPerDayValues = videosWithMomentum.map(v => v.viewsPerDay).sort((a, b) => a - b);
        const mid = Math.floor(viewsPerDayValues.length / 2);
        const medianViewsPerDay = viewsPerDayValues.length % 2 === 0
          ? (viewsPerDayValues[mid - 1] + viewsPerDayValues[mid]) / 2
          : viewsPerDayValues[mid];

        // Рассчитываем momentumScore для каждого видео
        if (medianViewsPerDay > 0) {
          videosWithMomentum.forEach(v => {
            v.momentumScore = (v.viewsPerDay / medianViewsPerDay) - 1;
          });

          // Средний momentum (только положительные значения)
          const positiveMomentum = videosWithMomentum.filter(v => v.momentumScore > 0);
          if (positiveMomentum.length > 0) {
            avgMomentum = positiveMomentum.reduce((sum, v) => sum + v.momentumScore, 0) / positiveMomentum.length;
          }

          // Топ momentum видео
          const sortedByMomentum = [...videosWithMomentum].sort((a, b) => b.momentumScore - a.momentumScore);
          if (sortedByMomentum.length > 0 && sortedByMomentum[0].momentumScore > 0) {
            const top = sortedByMomentum[0];
            topMomentumVideo = {
              videoId: top.videoId,
              title: top.title,
              channelTitle: top.channelTitle,
              viewsPerDay: Math.round(top.viewsPerDay),
              momentumScore: top.momentumScore,
              url: `https://www.youtube.com/watch?v=${top.videoId}`,
            };
          }
        }
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        totalCompetitors: Number(competitorStats.totalCompetitors),
        totalSubscribers: Number(competitorStats.totalSubscribers),
        totalVideos: Number(competitorStats.totalVideos),
        totalViews: Number(competitorStats.totalViews),
        avgMomentum: Math.round(avgMomentum * 100) / 100, // Округляем до 2 знаков
        topMomentumVideo,
        totalScriptsGenerated,
      },
    });
  } catch (error) {
    console.error("[Dashboard KPI] Error:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to fetch KPI data" },
      { status: 500 }
    );
  }
}
