import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export interface CompetitorSummary {
  id: number;
  channelId: string;
  handle: string;
  title: string;
  avatarUrl?: string;
  subscribers: number;
  viewsTotal: number;
  videoCount: number;
  avgViewsPerVideo: number;
  lastSyncedAt: number;
  viewsPerDay: number | null;
  growth7d: number | null;
}

/**
 * GET /api/competitors/compare
 * Возвращает сводные данные по всем конкурентам пользователя для сравнения
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log(`[CompareAPI] Fetching competitors for user: ${session.user.id}`);

    // Получаем всех конкурентов пользователя
    const competitorsResult = await db.execute({
      sql: `SELECT id, channelId, handle, title, avatarUrl, subscriberCount,
             videoCount, viewCount, lastSyncedAt
             FROM competitors
             WHERE userId = ?
             ORDER BY subscriberCount DESC`,
      args: [session.user.id],
    });

    if (competitorsResult.rows.length === 0) {
      console.log(`[CompareAPI] No competitors found for user`);
      return NextResponse.json({ competitors: [] });
    }

    console.log(`[CompareAPI] Found ${competitorsResult.rows.length} competitors`);

    // Формируем массив CompetitorSummary с дополнительными метриками
    const competitors: CompetitorSummary[] = await Promise.all(
      competitorsResult.rows.map(async (row) => {
        const channelId = String(row.channelId || "");
        const viewCount = Number(row.viewCount) || 0;
        const videoCount = Number(row.videoCount) || 0;
        const avgViewsPerVideo = videoCount > 0 ? Math.round(viewCount / videoCount) : 0;

        // Получаем метрики для расчета viewsPerDay и growth7d
        let viewsPerDay: number | null = null;
        let growth7d: number | null = null;

        try {
          // A. Две последние записи из channel_metrics для расчета viewsPerDay
          const latestMetricsResult = await db.execute({
            sql: `SELECT viewCount, subscriberCount, date
                  FROM channel_metrics
                  WHERE channelId = ?
                  ORDER BY date DESC
                  LIMIT 2`,
            args: [channelId],
          });

          if (latestMetricsResult.rows.length >= 2) {
            const last = latestMetricsResult.rows[0];
            const prev = latestMetricsResult.rows[1];

            const lastViewCount = Number(last.viewCount) || 0;
            const prevViewCount = Number(prev.viewCount) || 0;
            const lastDate = Number(last.date) || 0;
            const prevDate = Number(prev.date) || 0;

            const deltaViews = lastViewCount - prevViewCount;
            const days = Math.max(1, (lastDate - prevDate) / 86400);
            viewsPerDay = Math.round(deltaViews / days);
          }

          // B. Запись примерно 7 дней назад для расчета growth7d
          const weekAgoResult = await db.execute({
            sql: `SELECT viewCount, subscriberCount, date
                  FROM channel_metrics
                  WHERE channelId = ?
                    AND date <= strftime('%s','now') - 7*86400
                  ORDER BY date DESC
                  LIMIT 1`,
            args: [channelId],
          });

          // Получаем последнюю запись метрик для сравнения
          const currentMetricsResult = await db.execute({
            sql: `SELECT subscriberCount
                  FROM channel_metrics
                  WHERE channelId = ?
                  ORDER BY date DESC
                  LIMIT 1`,
            args: [channelId],
          });

          if (weekAgoResult.rows.length > 0 && currentMetricsResult.rows.length > 0) {
            const currentSubscribers = Number(currentMetricsResult.rows[0].subscriberCount) || 0;
            const weekAgoSubscribers = Number(weekAgoResult.rows[0].subscriberCount) || 0;
            growth7d = currentSubscribers - weekAgoSubscribers;
          }
        } catch (error) {
          console.error(`[CompareAPI] Error calculating metrics for channel ${channelId}:`, error);
          // Продолжаем с null значениями
        }

        return {
          channelId: channelId,
          handle: String(row.handle || ""),
          title: String(row.title || "Unknown"),
          avatarUrl: row.avatarUrl ? String(row.avatarUrl) : undefined,
          subscribers: Number(row.subscriberCount) || 0,
          viewsTotal: viewCount,
          videoCount: videoCount,
          avgViewsPerVideo: avgViewsPerVideo,
          lastSyncedAt: Number(row.lastSyncedAt) || Date.now(),
          viewsPerDay,
          growth7d,
        };
      })
    );

    console.log(`[CompareAPI] Returning ${competitors.length} competitor summaries`);

    return NextResponse.json({ competitors });
  } catch (error) {
    console.error("[CompareAPI] Error fetching competitors for comparison:", error);
    return NextResponse.json(
      { error: "Failed to fetch competitors for comparison" },
      { status: 500 }
    );
  }
}
