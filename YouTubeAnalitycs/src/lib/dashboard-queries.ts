import { db } from "./db";
import { cache } from "react";

// Types
export interface KPIData {
  totalCompetitors: number;
  totalSubscribers: number;
  totalVideos: number;
  totalViews: number;
  avgMomentum: number;
  topMomentumVideo: {
    videoId: string;
    title: string;
    channelTitle: string;
    viewsPerDay: number;
    momentumScore: number;
    url: string;
  } | null;
  totalScriptsGenerated: number;
}

export interface VideoPerformance {
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

export interface VideoPerformanceData {
  videos: VideoPerformance[];
  total: number;
  medianViewsPerDay: number;
  stats: {
    highMomentum: number;
    rising: number;
    normal: number;
    underperforming: number;
  };
}

// Helper functions
function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function categorizeByMomentum(score: number): VideoPerformance["category"] {
  if (score > 0.5) return "High Momentum";
  if (score > 0.1) return "Rising";
  if (score < -0.3) return "Underperforming";
  return "Normal";
}

/**
 * Fetches KPI data for dashboard - cached with React cache()
 */
export const getDashboardKPI = cache(async (userId: string): Promise<KPIData> => {
  // Single optimized query for competitors stats + channelIds
  const competitorsResult = await db.execute({
    sql: `
      SELECT
        channelId,
        title,
        subscriberCount,
        videoCount,
        viewCount
      FROM competitors
      WHERE userId = ?
    `,
    args: [userId],
  });

  const totalCompetitors = competitorsResult.rows.length;
  let totalSubscribers = 0;
  let totalVideos = 0;
  let totalViews = 0;
  const channelIds: string[] = [];
  const channelTitleMap = new Map<string, string>();

  competitorsResult.rows.forEach(row => {
    totalSubscribers += Number(row.subscriberCount) || 0;
    totalVideos += Number(row.videoCount) || 0;
    totalViews += Number(row.viewCount) || 0;
    channelIds.push(row.channelId as string);
    channelTitleMap.set(row.channelId as string, row.title as string);
  });

  // Scripts count
  const scriptsResult = await db.execute({
    sql: `SELECT COUNT(*) as count FROM generated_scripts WHERE userId = ?`,
    args: [userId],
  });
  const totalScriptsGenerated = Number(scriptsResult.rows[0]?.count) || 0;

  let avgMomentum = 0;
  let topMomentumVideo: KPIData["topMomentumVideo"] = null;

  if (channelIds.length > 0) {
    const placeholders = channelIds.map(() => "?").join(",");

    const videosResult = await db.execute({
      sql: `
        SELECT videoId, channelId, title, viewCount, publishDate
        FROM channel_videos
        WHERE channelId IN (${placeholders})
      `,
      args: [...channelIds],
    });

    if (videosResult.rows.length > 0) {
      const now = Date.now();

      // Фильтруем видео с валидной датой публикации
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
        const viewsPerDay = (Number(row.viewCount) || 0) / daysSincePublish;

        return {
          videoId: row.videoId as string,
          channelId: row.channelId as string,
          title: row.title as string,
          viewsPerDay,
          momentumScore: 0,
        };
      });

      const medianViewsPerDay = calculateMedian(videosWithMomentum.map(v => v.viewsPerDay));

      if (medianViewsPerDay > 0) {
        videosWithMomentum.forEach(v => {
          v.momentumScore = (v.viewsPerDay / medianViewsPerDay) - 1;
        });

        const positiveMomentum = videosWithMomentum.filter(v => v.momentumScore > 0);
        if (positiveMomentum.length > 0) {
          avgMomentum = positiveMomentum.reduce((sum, v) => sum + v.momentumScore, 0) / positiveMomentum.length;
        }

        const sorted = [...videosWithMomentum].sort((a, b) => b.momentumScore - a.momentumScore);
        if (sorted.length > 0 && sorted[0].momentumScore > 0) {
          const top = sorted[0];
          topMomentumVideo = {
            videoId: top.videoId,
            title: top.title,
            channelTitle: channelTitleMap.get(top.channelId) || "Unknown",
            viewsPerDay: Math.round(top.viewsPerDay),
            momentumScore: top.momentumScore,
            url: `https://www.youtube.com/watch?v=${top.videoId}`,
          };
        }
      }
    }
  }

  return {
    totalCompetitors,
    totalSubscribers,
    totalVideos,
    totalViews,
    avgMomentum: Math.round(avgMomentum * 100) / 100,
    topMomentumVideo,
    totalScriptsGenerated,
  };
});

/**
 * Fetches video performance data - cached with React cache()
 */
export const getVideoPerformance = cache(async (
  userId: string,
  sortBy: "momentum" | "viewsPerDay" | "recent" = "momentum",
  limit: number = 10
): Promise<VideoPerformanceData> => {
  const competitorsResult = await db.execute({
    sql: `SELECT channelId, title FROM competitors WHERE userId = ?`,
    args: [userId],
  });

  if (competitorsResult.rows.length === 0) {
    return {
      videos: [],
      total: 0,
      medianViewsPerDay: 0,
      stats: { highMomentum: 0, rising: 0, normal: 0, underperforming: 0 },
    };
  }

  const channelIds = competitorsResult.rows.map(row => row.channelId as string);
  const channelTitleMap = new Map<string, string>();
  competitorsResult.rows.forEach(row => {
    channelTitleMap.set(row.channelId as string, row.title as string);
  });

  const placeholders = channelIds.map(() => "?").join(",");

  // ИСТОЧНИК ДАТЫ: колонка publishDate
  const videosResult = await db.execute({
    sql: `
      SELECT videoId, channelId, title, thumbnailUrl, viewCount, likeCount, commentCount, publishDate
      FROM channel_videos
      WHERE channelId IN (${placeholders})
      ORDER BY publishDate DESC
    `,
    args: [...channelIds],
  });

  if (videosResult.rows.length === 0) {
    return {
      videos: [],
      total: 0,
      medianViewsPerDay: 0,
      stats: { highMomentum: 0, rising: 0, normal: 0, underperforming: 0 },
    };
  }

  // Фильтруем видео с валидной датой публикации
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

  if (validRows.length === 0) {
    return {
      videos: [],
      total: 0,
      medianViewsPerDay: 0,
      stats: { highMomentum: 0, rising: 0, normal: 0, underperforming: 0 },
    };
  }

  const now = Date.now();
  const videosWithMetrics: VideoPerformance[] = validRows.map(row => {
    const publishDateMs = new Date(row.publishDate as string).getTime();
    const daysSincePublish = Math.max(1, (now - publishDateMs) / (1000 * 60 * 60 * 24));
    const viewsPerDay = (Number(row.viewCount) || 0) / daysSincePublish;
    const channelId = row.channelId as string;

    return {
      videoId: row.videoId as string,
      title: row.title as string,
      channelId,
      channelTitle: channelTitleMap.get(channelId) || "Unknown",
      thumbnailUrl: row.thumbnailUrl as string | null,
      viewCount: Number(row.viewCount) || 0,
      likeCount: Number(row.likeCount) || 0,
      commentCount: Number(row.commentCount) || 0,
      publishedAt: row.publishDate as string, // UI совместимость: используем publishDate из БД
      viewsPerDay,
      momentumScore: 0,
      category: "Normal" as const,
      url: `https://www.youtube.com/watch?v=${row.videoId}`,
    };
  });

  const medianViewsPerDay = calculateMedian(videosWithMetrics.map(v => v.viewsPerDay));

  if (medianViewsPerDay > 0) {
    videosWithMetrics.forEach(v => {
      v.momentumScore = (v.viewsPerDay / medianViewsPerDay) - 1;
      v.category = categorizeByMomentum(v.momentumScore);
      v.viewsPerDay = Math.round(v.viewsPerDay);
      v.momentumScore = Math.round(v.momentumScore * 100) / 100;
    });
  }

  // Sort
  let sortedVideos: VideoPerformance[];
  switch (sortBy) {
    case "viewsPerDay":
      sortedVideos = [...videosWithMetrics].sort((a, b) => b.viewsPerDay - a.viewsPerDay);
      break;
    case "recent":
      sortedVideos = [...videosWithMetrics].sort(
        (a, b) => (b.publishedAt as string).localeCompare(a.publishedAt as string)
      );
      break;
    case "momentum":
    default:
      sortedVideos = [...videosWithMetrics].sort((a, b) => b.momentumScore - a.momentumScore);
      break;
  }

  return {
    videos: sortedVideos.slice(0, limit),
    total: videosWithMetrics.length,
    medianViewsPerDay: Math.round(medianViewsPerDay),
    stats: {
      highMomentum: videosWithMetrics.filter(v => v.category === "High Momentum").length,
      rising: videosWithMetrics.filter(v => v.category === "Rising").length,
      normal: videosWithMetrics.filter(v => v.category === "Normal").length,
      underperforming: videosWithMetrics.filter(v => v.category === "Underperforming").length,
    },
  };
});
