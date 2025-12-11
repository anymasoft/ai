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

    // Получаем видео каждого конкурента для расчета viewsPerDay
    const videosResult = await db.execute({
      sql: `
        SELECT
          channelId,
          publishDate,
          viewCountInt
        FROM channel_videos
        WHERE channelId IN (${competitorsResult.rows.map(() => "?").join(",")})
        ORDER BY channelId, publishDate ASC
      `,
      args: competitorsResult.rows.map(row => row.channelId),
    });

    // Группируем видео по каналу
    const videosMap = new Map<string, Array<{
      publishDate: string;
      viewCount: number;
    }>>();

    videosResult.rows.forEach(row => {
      const channelId = String(row.channelId);
      if (!videosMap.has(channelId)) {
        videosMap.set(channelId, []);
      }
      videosMap.get(channelId)!.push({
        publishDate: row.publishDate as string,
        viewCount: Number(row.viewCountInt) || 0,
      });
    });

    console.log(`[CompareAPI] Loaded videos for ${videosMap.size} channels`);
    const competitors: CompetitorSummary[] = await Promise.all(
      competitorsResult.rows.map(async (row) => {
        const channelId = String(row.channelId || "");
        const viewCount = Number(row.viewCount) || 0;
        const videoCount = Number(row.videoCount) || 0;
        const avgViewsPerVideo = videoCount > 0 ? Math.round(viewCount / videoCount) : 0;

        // НОВАЯ АРХИТЕКТУРА: Вычисляем метрики в real-time без исторических данных
        let viewsPerDay: number | null = null;
        let growth7d: number | null = null;

        try {
          // Рассчитываем viewsPerDay на основе видео
          const videos = videosMap.get(channelId) || [];
          if (videos.length >= 2) {
            // Дата первого видео
            const firstPublishDate = new Date(videos[0].publishDate).getTime();
            const lastPublishDate = new Date(videos[videos.length - 1].publishDate).getTime();
            const daysSinceFirstVideo = Math.max(1, (lastPublishDate - firstPublishDate) / (1000 * 60 * 60 * 24));
            viewsPerDay = Math.round(viewCount / daysSinceFirstVideo);
          } else if (videos.length === 1) {
            // Если только одно видео — используем его просмотры как viewsPerDay
            viewsPerDay = videos[0].viewCount;
          }

          // growth7d — не вычисляем без исторических данных
          // В будущем можно использовать TOP-3 видео momentum
          growth7d = null;
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
