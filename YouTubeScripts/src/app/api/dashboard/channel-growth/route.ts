import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

interface ChannelGrowthData {
  channelId: string;
  handle: string;
  title: string;
  avatarUrl: string | null;
  currentSubscribers: number;
  currentViews: number;
  currentVideos: number;
  avgViewsPerVideo: number;
  uploadFrequency: number; // videos per month
  subscribersHistory: Array<{
    date: string;
    subscribers: number;
  }>;
  growth7d: number | null;
  growth30d: number | null;
  lastSyncedAt: number;
}

/**
 * GET /api/dashboard/channel-growth
 * Возвращает данные роста по каждому конкурирующему каналу:
 * - subscribers history
 * - avgViewsPerVideo
 * - upload frequency
 *
 * Query params:
 * - period: 7 | 30 | 90 (default: 30) - период для истории подписчиков
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

    // Получаем всех конкурентов пользователя
    const competitorsResult = await db.execute({
      sql: `
        SELECT
          channelId,
          handle,
          title,
          avatarUrl,
          subscriberCount,
          videoCount,
          viewCount,
          lastSyncedAt
        FROM competitors
        WHERE userId = ?
        ORDER BY subscriberCount DESC
      `,
      args: [userId],
    });

    if (competitorsResult.rows.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          channels: [],
          period: validPeriod,
        },
      });
    }

    const channelIds = competitorsResult.rows.map(row => row.channelId as string);
    const placeholders = channelIds.map(() => "?").join(",");

    // НОВАЯ АРХИТЕКТУРА: Метрики вычисляются в real-time, без хранения истории.
    // Создаём синтетические данные роста на основе текущих метрик.
    const metricsMap = new Map<string, Array<{ date: string; subscribers: number; views: number }>>();
    const hasHistoricalData = false; // Всегда используем synthetic данные

    // Создаём fallback для каждого канала с одной точкой (сегодняшний день)
    const todayStr = new Date().toISOString().split("T")[0];

    competitorsResult.rows.forEach(row => {
      const channelId = row.channelId as string;

      metricsMap.set(channelId, [{
        date: todayStr,
        subscribers: Number(row.subscriberCount) || 0,
        views: Number(row.viewCount) || 0,
      }]);
    });

    // Получаем количество видео и даты публикации для расчета upload frequency
    const videosResult = await db.execute({
      sql: `
        SELECT
          channelId,
          publishDate
        FROM channel_videos
        WHERE channelId IN (${placeholders})
        ORDER BY channelId, publishDate DESC
      `,
      args: [...channelIds],
    });

    // Группируем видео по каналу для расчета частоты загрузок
    const videoDatesMap = new Map<string, number[]>();
    videosResult.rows.forEach(row => {
      const channelId = row.channelId as string;
      const publishDateMs = new Date(row.publishDate as string).getTime();

      if (!videoDatesMap.has(channelId)) {
        videoDatesMap.set(channelId, []);
      }

      videoDatesMap.get(channelId)!.push(publishDateMs);
    });

    // Формируем данные по каждому каналу
    const channels: ChannelGrowthData[] = competitorsResult.rows.map(row => {
      const channelId = row.channelId as string;
      const currentSubscribers = Number(row.subscriberCount);
      const currentViews = Number(row.viewCount);
      const currentVideos = Number(row.videoCount);

      // Рассчитываем avgViewsPerVideo
      const avgViewsPerVideo = currentVideos > 0 ? Math.round(currentViews / currentVideos) : 0;

      // Рассчитываем upload frequency (видео в месяц)
      const videoDatesMs = videoDatesMap.get(channelId) || [];
      let uploadFrequency = 0;

      if (videoDatesMs.length >= 2) {
        const latestDateMs = videoDatesMs[0];
        const oldestDateMs = videoDatesMs[videoDatesMs.length - 1];
        const monthsSpan = Math.max(1, (latestDateMs - oldestDateMs) / (1000 * 60 * 60 * 24 * 30));
        uploadFrequency = Math.round((videoDatesMs.length / monthsSpan) * 10) / 10;
      } else if (videoDatesMs.length === 1) {
        uploadFrequency = 1; // Минимум 1 видео
      }

      // Получаем историю подписчиков
      const metrics = metricsMap.get(channelId) || [];
      const subscribersHistory = metrics.map(m => ({
        date: m.date,
        subscribers: m.subscribers,
      }));

      // Рассчитываем growth7d и growth30d
      // НОВАЯ АРХИТЕКТУРА: Без исторических данных, growth равен null
      // В будущем можно рассчитать synthetic growth на основе TOP-12 видео momentum
      let growth7d: number | null = null;
      let growth30d: number | null = null;

      return {
        channelId,
        handle: row.handle as string,
        title: row.title as string,
        avatarUrl: row.avatarUrl as string | null,
        currentSubscribers,
        currentViews,
        currentVideos,
        avgViewsPerVideo,
        uploadFrequency,
        subscribersHistory,
        growth7d,
        growth30d,
        lastSyncedAt: Number(row.lastSyncedAt),
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        channels,
        period: validPeriod,
        summary: {
          totalChannels: channels.length,
          totalSubscribers: channels.reduce((sum, c) => sum + c.currentSubscribers, 0),
          avgUploadFrequency: channels.length > 0
            ? Math.round((channels.reduce((sum, c) => sum + c.uploadFrequency, 0) / channels.length) * 10) / 10
            : 0,
        },
        message: "Data calculated in real-time without historical metrics storage",
      },
    });
  } catch (error) {
    console.error("[Dashboard ChannelGrowth] Error:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Failed to fetch channel growth data" },
      { status: 500 }
    );
  }
}
