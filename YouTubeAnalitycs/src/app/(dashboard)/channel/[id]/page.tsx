import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createClient } from "@libsql/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Users, Video, Eye, BarChart3, Calendar, AlertCircle, ArrowLeft, ExternalLink, Lightbulb, Target } from "lucide-react";
import { ChannelAnalytics } from "@/components/channel/ChannelAnalytics";
import { ChannelAvatar } from "@/components/channel-avatar";
import { GenerateSwotButton } from "@/components/channel/GenerateSwotButton";
import { SWOTAnalysisBlock } from "@/components/channel/SWOTAnalysisBlock";
import type { SwotPoint, VideoIdea } from "@/lib/ai/analyzeChannel";
import { getUserPlan } from "@/lib/user-plan";

/**
 * Отключаем кеширование страницы канала.
 * Необходимо для корректной работы router.refresh() после синхронизации видео.
 * Без этого страница может быть закеширована, и router.refresh() не будет эффективен.
 */
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

/**
 * Патчим глобальный fetch для совместимости с NextAuth.
 * NextAuth нуждается в кешировании /api/auth/session, иначе CLIENT_FETCH_ERROR.
 * Для остальных запросов применяем cache: "no-store" через init параметры.
 */
const originalFetch = fetch;
(globalThis as any).fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  try {
    if (typeof input === "string" && input.startsWith("/api/auth/")) {
      // Для NextAuth endpoints — использовать обычное поведение без cache override
      console.log("[Page Fetch Override] NextAuth request detected, using default behavior:", input);
      return originalFetch(input, init);
    }
  } catch (err) {
    console.warn("[Page Fetch Override] Error checking URL:", err);
  }

  // Для всех остальных запросов — запрещаем кеширование
  const newInit = {
    ...init,
    cache: "no-store" as const
  };
  return originalFetch(input, newInit);
};

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Форматирует числа для читаемости (1000000 => 1M)
 */
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

/**
 * Форматирует дату
 */
function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Вычисляет средние просмотры на видео
 */
function calculateAvgViews(viewCount: number, videoCount: number): number {
  if (videoCount === 0) return 0;
  return Math.round(viewCount / videoCount);
}

export default async function ChannelPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);

  // Проверка аутентификации
  if (!session?.user?.id) {
    redirect("/api/auth/signin");
  }

  const { id } = await params;
  const competitorId = parseInt(id, 10);

  if (!Number.isFinite(competitorId) || competitorId <= 0) {
    redirect("/competitors");
  }

  const dbPath = process.env.DATABASE_URL || "file:sqlite.db";
  const client = createClient({
    url: dbPath.startsWith("file:") ? dbPath : `file:${dbPath}`,
  });

  try {
    // Получаем данные канала из БД
    const competitorResult = await client.execute({
      sql: `SELECT id, userId, platform, channelId, handle, title,
             avatarUrl, subscriberCount, videoCount, viewCount,
             lastSyncedAt, createdAt
             FROM competitors WHERE id = ? AND userId = ?`,
      args: [competitorId, session.user.id],
    });

    // Если канал не найден или не принадлежит пользователю
    if (competitorResult.rows.length === 0) {
      redirect("/competitors");
    }

    const competitor = { ...competitorResult.rows[0] } as any;

    // Диагностика: убедиться что competitorId и channelId корректны
    console.log(`[ChannelPage] competitorId: ${competitorId}, channelId: ${competitor.channelId}`);

    // Получаем AI-анализ (если есть)
    const aiInsightResult = await client.execute({
      sql: "SELECT * FROM ai_insights WHERE competitorId = ? ORDER BY createdAt DESC LIMIT 1",
      args: [competitorId],
    });

    const aiInsight = aiInsightResult.rows.length > 0 ? aiInsightResult.rows[0] as any : null;

    // Парсим JSON данные из ai_insights (поддержка старого и нового формата)
    const insight = aiInsight
      ? {
          strengths: JSON.parse(aiInsight.strengths as string) as SwotPoint[],
          weaknesses: JSON.parse(aiInsight.weaknesses as string) as SwotPoint[],
          opportunities: JSON.parse(aiInsight.opportunities as string) as SwotPoint[],
          threats: JSON.parse(aiInsight.threats as string) as SwotPoint[],
          strategicSummary: aiInsight.strategicSummary ? JSON.parse(aiInsight.strategicSummary as string) as string[] : [],
          contentPatterns: aiInsight.contentPatterns ? JSON.parse(aiInsight.contentPatterns as string) as string[] : [],
          videoIdeas: aiInsight.videoIdeas ? JSON.parse(aiInsight.videoIdeas as string) as VideoIdea[] : [],
          generatedAt: aiInsight.generatedAt as string || new Date(aiInsight.createdAt as number).toISOString(),
        }
      : null;

    const avgViews = calculateAvgViews(competitor.viewCount as number, competitor.videoCount as number);

    // Получаем исторические метрики для графиков
    const metricsResult = await client.execute({
      sql: "SELECT * FROM channel_metrics WHERE channelId = ? ORDER BY fetchedAt",
      args: [competitor.channelId],
    });

    const metrics = metricsResult.rows.map(row => ({ ...row }));

    // НОВОЕ (ЭТАП 4): Загружаем TOP-12 видео из БД (архитектура TOP-12 ONLY)
    // Видео уже синхронизированы при добавлении конкурента
    // Просто получаем готовые данные из channel_videos
    const videosResult = await client.execute({
      sql: `SELECT id, channelId, videoId, title, thumbnailUrl, viewCountInt, likeCountInt, commentCountInt,
             publishDate, durationSeconds, fetchedAt, updatedAt
             FROM channel_videos
             WHERE channelId = ?
             ORDER BY viewCountInt DESC
             LIMIT 12`,
      args: [competitor.channelId],
    });

    const videos = (videosResult.rows || []).map((video: any) => ({
      id: video.id,
      channelId: video.channelId,
      videoId: video.videoId,
      title: video.title,
      thumbnailUrl: video.thumbnailUrl,
      viewCountInt: video.viewCountInt,
      likeCountInt: video.likeCountInt,
      commentCountInt: video.commentCountInt,
      publishDate: video.publishDate,
      durationSeconds: video.durationSeconds,
      fetchedAt: video.fetchedAt,
      updatedAt: video.updatedAt,
    }));

    console.log("[Channel Page] Загружены видео из БД:", {
      channelId: competitor.channelId,
      videosCount: videos.length,
    });

    // АРХИТЕКТУРА TOP-12 ONLY: Все аналитические данные загружаются автоматически в SSR
    // Таблицы user_channel_*_state удалены - флаги hasShownX больше не нужны
    // Все данные готовы при загрузке страницы

    // hasVideos определяется наличием данных в videos массиве
    const hasVideos = videos.length > 0;

    // НОВОЕ (ИТЕРАЦИЯ 9): hasComments также всегда false при SSR
    // Комментарии проверяются на клиенте после загрузки видео
    const hasComments = false;

    // Получаем Content Intelligence анализ
    const intelligenceResult = await client.execute({
      sql: "SELECT * FROM content_intelligence WHERE channelId = ? ORDER BY generatedAt DESC LIMIT 1",
      args: [competitor.channelId],
    });

    const intelligence = intelligenceResult.rows.length > 0 ? intelligenceResult.rows[0] as any : null;

    // Парсим JSON данные из content_intelligence
    const contentData = intelligence ? JSON.parse(intelligence.data as string) : null;

    // Получаем Momentum Insights анализ
    const momentumResult = await client.execute({
      sql: "SELECT * FROM momentum_insights WHERE channelId = ? ORDER BY generatedAt DESC LIMIT 1",
      args: [competitor.channelId],
    });

    const momentum = momentumResult.rows.length > 0 ? momentumResult.rows[0] as any : null;

    // Парсим JSON данные из momentum_insights
    const momentumData = momentum ? JSON.parse(momentum.data as string) : null;

    // Получаем Audience Insights анализ
    const audienceResult = await client.execute({
      sql: "SELECT * FROM audience_insights WHERE channelId = ? ORDER BY generatedAt DESC LIMIT 1",
      args: [competitor.channelId],
    });

    const audience = audienceResult.rows.length > 0 ? audienceResult.rows[0] as any : null;

    // Парсим JSON данные из audience_insights
    const audienceData = audience ? JSON.parse(audience.data as string) : null;

    // Получаем Comment Insights анализ
    const commentsResult = await client.execute({
      sql: "SELECT * FROM comment_insights WHERE channelId = ? ORDER BY generatedAt DESC LIMIT 1",
      args: [competitor.channelId],
    });

    const comments = commentsResult.rows.length > 0 ? commentsResult.rows[0] as any : null;

    // Парсим JSON данные из comment_insights
    const commentsData = comments ? JSON.parse(comments.data as string) : null;

    // Получаем Deep Comment Analysis (AI v2.0)
    const deepAnalysisResult = await client.execute({
      sql: "SELECT * FROM channel_ai_comment_insights WHERE channelId = ? ORDER BY createdAt DESC LIMIT 1",
      args: [competitor.channelId],
    });

    const deepAnalysis = deepAnalysisResult.rows.length > 0 ? deepAnalysisResult.rows[0] as any : null;

    // Парсим JSON данные из channel_ai_comment_insights
    const deepAnalysisData = deepAnalysis ? JSON.parse(deepAnalysis.resultJson as string) : null;

    // Debug: проверка channelId и количества метрик
    console.log("channelId:", competitor.channelId);
    console.log("metrics rows:", metrics.length);
    console.log("videos rows:", videos.length);
    console.log("content intelligence:", contentData ? "exists" : "not found");
    if (contentData) {
      console.log("contentData format:", contentData.format || "json (old format)");
      console.log("contentData has report:", !!contentData.report);
    }
    console.log("momentum insights:", momentumData ? "exists" : "not found");
    console.log("audience insights:", audienceData ? "exists" : "not found");
    console.log("comment insights:", commentsData ? "exists" : "not found");
    console.log("deep analysis:", deepAnalysisData ? "exists" : "not found");

    return (
      <div className="container mx-auto px-4 md:px-6 space-y-6 pb-12">
        {/* Back button */}
        <div className="pt-6">
          <Link
            href="/competitors"
            className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Competitors
          </Link>
        </div>

        {/* Хедер канала */}
        <div className="flex items-center gap-4">
          <ChannelAvatar
            src={competitor.avatarUrl as string}
            alt={competitor.title as string}
            className="w-20 h-20 text-2xl border-2 border-border"
          />

          <div className="flex-1">
            <h1 className="text-2xl font-semibold mb-1">{competitor.title as string}</h1>

            <div className="text-sm text-muted-foreground mb-1">
              {competitor.handle as string}
            </div>

            <a
              href={(competitor.handle as string).startsWith('http') ? (competitor.handle as string) : `https://www.youtube.com/@${competitor.handle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-blue-600 text-sm hover:underline dark:text-blue-400"
            >
              View on YouTube
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Метрики в строку */}
        <div className="flex items-center gap-6 text-sm flex-wrap">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">{formatNumber(competitor.subscriberCount as number)}</span>
            <span className="text-muted-foreground">subscribers</span>
          </div>
          <div className="flex items-center gap-2">
            <Video className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">{formatNumber(competitor.videoCount as number)}</span>
            <span className="text-muted-foreground">videos</span>
          </div>
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">{formatNumber(competitor.viewCount as number)}</span>
            <span className="text-muted-foreground">views</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Updated: {formatDate(competitor.lastSyncedAt as number)}</span>
          </div>
        </div>

        <Separator />

        {/* Overview - Ключевые метрики */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border rounded-lg p-4 bg-muted/40">
              <div className="text-sm text-muted-foreground mb-2">Subscribers</div>
              <div className="text-3xl font-bold">{formatNumber(competitor.subscriberCount as number)}</div>
            </div>

            <div className="border rounded-lg p-4 bg-muted/40">
              <div className="text-sm text-muted-foreground mb-2">Total Views</div>
              <div className="text-3xl font-bold">{formatNumber(competitor.viewCount as number)}</div>
            </div>

            <div className="border rounded-lg p-4 bg-muted/40">
              <div className="text-sm text-muted-foreground mb-2">Avg. Views per Video</div>
              <div className="text-3xl font-bold">{formatNumber(avgViews)}</div>
            </div>
          </div>
        </div>

      {/* AI SWOT Analysis */}
      <SWOTAnalysisBlock
        channelId={competitor.channelId as string}
        insight={insight}
      />

        {/* Analytics Section */}
        <ChannelAnalytics
          channelId={competitor.channelId as string}
          metrics={metrics}
          videos={videos}
          contentData={contentData ? { ...contentData, generatedAt: intelligence?.generatedAt } : null}
          momentumData={momentumData ? { ...momentumData, generatedAt: momentum?.generatedAt } : null}
          audienceData={audienceData ? { ...audienceData, generatedAt: audience?.generatedAt } : null}
          commentsData={commentsData ? { ...commentsData, generatedAt: comments?.generatedAt } : null}
          deepAnalysisData={deepAnalysisData ? { ...deepAnalysisData, createdAt: deepAnalysis?.createdAt } : null}
          hasVideos={hasVideos}
          hasComments={hasComments}
          userPlan={getUserPlan(session)}
        />
      </div>
    );
  } finally {
    client.close();
  }
}
