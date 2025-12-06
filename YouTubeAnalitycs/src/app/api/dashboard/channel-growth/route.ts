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

    // Получаем историю метрик для всех каналов за период
    const periodStartTimestamp = Math.floor((Date.now() - validPeriod * 24 * 60 * 60 * 1000) / 1000);
    const placeholders = channelIds.map(() => "?").join(",");

    const metricsResult = await db.execute({
      sql: `
        SELECT
          channelId,
          subscriberCount,
          viewCount,
          date
        FROM channel_metrics
        WHERE channelId IN (${placeholders})
          AND date >= ?
        ORDER BY channelId, date ASC
      `,
      args: [...channelIds, periodStartTimestamp],
    });

    // Группируем метрики по каналу
    const metricsMap = new Map<string, Array<{ date: string; subscribers: number; views: number }>>();

    metricsResult.rows.forEach(row => {
      const channelId = row.channelId as string;
      const rawDate = row.date;

      // Если дата отсутствует или некорректна — пропускаем строку
      if (!rawDate || isNaN(Number(rawDate))) {
        return;
      }

      // Нормализация формата timestamp
      let ts = Number(rawDate);

      // Если timestamp в миллисекундах — приводим к секундам
      if (ts > 10_000_000_000) {
        ts = Math.floor(ts / 1000);
      }

      const dateTimestamp = ts;
      const dateStr = new Date(dateTimestamp * 1000).toISOString().split("T")[0];

      if (!metricsMap.has(channelId)) {
        metricsMap.set(channelId, []);
      }

      metricsMap.get(channelId)!.push({
        date: dateStr,
        subscribers: Number(row.subscriberCount),
        views: Number(row.viewCount),
      });
    });

    // Флаг: есть ли реальные исторические данные
    const hasHistoricalData = metricsMap.size > 0;

    // Если нет исторических данных — создаём fallback из текущих данных конкурентов
    if (!hasHistoricalData) {
      const todayStr = new Date().toISOString().split("T")[0];

      competitorsResult.rows.forEach(row => {
        const channelId = row.channelId as string;
        const lastSyncedAt = Number(row.lastSyncedAt);

        // Нормализуем дату lastSyncedAt
        let syncTs = lastSyncedAt;
        if (syncTs > 10_000_000_000) {
          syncTs = Math.floor(syncTs / 1000);
        }

        // Используем дату синхронизации или сегодняшний день
        const dateStr = syncTs > 0
          ? new Date(syncTs * 1000).toISOString().split("T")[0]
          : todayStr;

        metricsMap.set(channelId, [{
          date: dateStr,
          subscribers: Number(row.subscriberCount) || 0,
          views: Number(row.viewCount) || 0,
        }]);
      });
    }

    // Получаем количество видео и даты публикации для расчета upload frequency
    const videosResult = await db.execute({
      sql: `
        SELECT
          channelId,
          publishedAt
        FROM channel_videos
        WHERE channelId IN (${placeholders})
        ORDER BY channelId, publishedAt DESC
      `,
      args: [...channelIds],
    });

    // Группируем видео по каналу для расчета частоты загрузок
    const videoDatesMap = new Map<string, Date[]>();
    videosResult.rows.forEach(row => {
      const channelId = row.channelId as string;
      const publishedAt = new Date(row.publishedAt as string);

      if (!videoDatesMap.has(channelId)) {
        videoDatesMap.set(channelId, []);
      }

      videoDatesMap.get(channelId)!.push(publishedAt);
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
      const videoDates = videoDatesMap.get(channelId) || [];
      let uploadFrequency = 0;

      if (videoDates.length >= 2) {
        const latestDate = videoDates[0];
        const oldestDate = videoDates[videoDates.length - 1];
        const monthsSpan = Math.max(1, (latestDate.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
        uploadFrequency = Math.round((videoDates.length / monthsSpan) * 10) / 10;
      } else if (videoDates.length === 1) {
        uploadFrequency = 1; // Минимум 1 видео
      }

      // Получаем историю подписчиков
      const metrics = metricsMap.get(channelId) || [];
      const subscribersHistory = metrics.map(m => ({
        date: m.date,
        subscribers: m.subscribers,
      }));

      // Рассчитываем growth7d и growth30d
      let growth7d: number | null = null;
      let growth30d: number | null = null;

      if (metrics.length >= 2) {
        const now = Date.now();
        const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
        const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

        // Находим ближайшую запись к 7 дням назад
        const metric7dAgo = metrics.find(m => {
          const metricDate = new Date(m.date).getTime();
          return metricDate <= sevenDaysAgo;
        });

        if (metric7dAgo) {
          growth7d = currentSubscribers - metric7dAgo.subscribers;
        }

        // Находим ближайшую запись к 30 дням назад
        const metric30dAgo = metrics.find(m => {
          const metricDate = new Date(m.date).getTime();
          return metricDate <= thirtyDaysAgo;
        });

        if (metric30dAgo) {
          growth30d = currentSubscribers - metric30dAgo.subscribers;
        }
      }

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
        ...(hasHistoricalData
          ? {}
          : { message: "Fallback data: using current competitor stats until historical metrics are accumulated" }
        ),
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
