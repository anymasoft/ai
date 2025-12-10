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

    // НОВОЕ (ИТЕРАЦИЯ 9): Отключаем получение видео через SSR
    // Видео теперь загружаются чисто на клиенте через /api/channel/[id]/videos/page?page=0
    // Это позволяет реализовать правильную клиентскую пагинацию (12 видео за раз)
    const videos: any[] = [];

    // Получаем состояние синхронизации видео для пользователя
    let userStateResult = await client.execute({
      sql: "SELECT hasSyncedTopVideos, hasShownVideos FROM user_channel_state WHERE userId = ? AND channelId = ?",
      args: [session.user.id, competitor.channelId],
    });

    // Если записи нет, создаём её с дефолтными значениями
    if (userStateResult.rows.length === 0) {
      try {
        await client.execute({
          sql: `INSERT INTO user_channel_state (userId, channelId, hasSyncedTopVideos, hasShownVideos)
                VALUES (?, ?, 0, 0)
                ON CONFLICT(userId, channelId) DO NOTHING`,
          args: [session.user.id, competitor.channelId],
        });
        console.log("[Channel Page] Created user_channel_state for:", {
          userId: session.user.id,
          channelId: competitor.channelId,
        });
        // Перезапрашиваем данные после создания
        userStateResult = await client.execute({
          sql: "SELECT hasSyncedTopVideos, hasShownVideos FROM user_channel_state WHERE userId = ? AND channelId = ?",
          args: [session.user.id, competitor.channelId],
        });
      } catch (error) {
        console.warn("[Channel Page] Failed to create user_channel_state:", error);
      }
    }

    const hasSyncedTopVideos = userStateResult.rows.length > 0
      ? (userStateResult.rows[0].hasSyncedTopVideos as number) === 1
      : false;

    const hasShownVideos = userStateResult.rows.length > 0
      ? (userStateResult.rows[0].hasShownVideos as number) === 1
      : false;

    // DEBUG: логируем состояние видео для отладки UI обновления
    if (process.env.NODE_ENV === "development") {
      console.log(`[ChannelPage DEBUG] user_channel_state для userId=${session.user.id}, channelId=${competitor.channelId}:`, {
        hasSyncedTopVideos,
        hasShownVideos,
        totalVideos: videos.length,
        userStateRows: userStateResult.rows.length,
      });
    }

    // Получаем состояние показа метрик для пользователя
    let metricsStateResult = await client.execute({
      sql: "SELECT hasShownMetrics FROM user_channel_metrics_state WHERE userId = ? AND channelId = ?",
      args: [session.user.id, competitor.channelId],
    });

    // Если записи нет, создаём её с дефолтными значениями
    if (metricsStateResult.rows.length === 0) {
      try {
        await client.execute({
          sql: `INSERT INTO user_channel_metrics_state (userId, channelId, hasShownMetrics)
                VALUES (?, ?, 0)
                ON CONFLICT(userId, channelId) DO NOTHING`,
          args: [session.user.id, competitor.channelId],
        });
        console.log("[Channel Page] Created user_channel_metrics_state for:", {
          userId: session.user.id,
          channelId: competitor.channelId,
        });
        // Перезапрашиваем данные после создания
        metricsStateResult = await client.execute({
          sql: "SELECT hasShownMetrics FROM user_channel_metrics_state WHERE userId = ? AND channelId = ?",
          args: [session.user.id, competitor.channelId],
        });
      } catch (error) {
        console.warn("[Channel Page] Failed to create user_channel_metrics_state:", error);
      }
    }

    const hasShownMetrics = metricsStateResult.rows.length > 0
      ? (metricsStateResult.rows[0].hasShownMetrics as number) === 1
      : false;

    // Получаем состояние показа аудитории для пользователя
    let audienceStateResult = await client.execute({
      sql: "SELECT hasShownAudience FROM user_channel_audience_state WHERE userId = ? AND channelId = ?",
      args: [session.user.id, competitor.channelId],
    });

    // Если записи нет, создаём её с дефолтными значениями
    if (audienceStateResult.rows.length === 0) {
      try {
        await client.execute({
          sql: `INSERT INTO user_channel_audience_state (userId, channelId, hasShownAudience)
                VALUES (?, ?, 0)
                ON CONFLICT(userId, channelId) DO NOTHING`,
          args: [session.user.id, competitor.channelId],
        });
        console.log("[Channel Page] Created user_channel_audience_state for:", {
          userId: session.user.id,
          channelId: competitor.channelId,
        });
        // Перезапрашиваем данные после создания
        audienceStateResult = await client.execute({
          sql: "SELECT hasShownAudience FROM user_channel_audience_state WHERE userId = ? AND channelId = ?",
          args: [session.user.id, competitor.channelId],
        });
      } catch (error) {
        console.warn("[Channel Page] Failed to create user_channel_audience_state:", error);
      }
    }

    const hasShownAudience = audienceStateResult.rows.length > 0
      ? (audienceStateResult.rows[0].hasShownAudience as number) === 1
      : false;

    // Получаем состояние показа momentum для пользователя
    let momentumStateResult = await client.execute({
      sql: "SELECT hasShownMomentum FROM user_channel_momentum_state WHERE userId = ? AND channelId = ?",
      args: [session.user.id, competitor.channelId],
    });

    // Если записи нет, создаём её с дефолтными значениями
    if (momentumStateResult.rows.length === 0) {
      try {
        await client.execute({
          sql: `INSERT INTO user_channel_momentum_state (userId, channelId, hasShownMomentum)
                VALUES (?, ?, 0)
                ON CONFLICT(userId, channelId) DO NOTHING`,
          args: [session.user.id, competitor.channelId],
        });
        console.log("[Channel Page] Created user_channel_momentum_state for:", {
          userId: session.user.id,
          channelId: competitor.channelId,
        });
        // Перезапрашиваем данные после создания
        momentumStateResult = await client.execute({
          sql: "SELECT hasShownMomentum FROM user_channel_momentum_state WHERE userId = ? AND channelId = ?",
          args: [session.user.id, competitor.channelId],
        });
      } catch (error) {
        console.warn("[Channel Page] Failed to create user_channel_momentum_state:", error);
      }
    }

    const hasShownMomentum = momentumStateResult.rows.length > 0
      ? (momentumStateResult.rows[0].hasShownMomentum as number) === 1
      : false;

    // Получаем состояние показа контент-аналитики для пользователя
    let contentStateResult = await client.execute({
      sql: "SELECT hasShownContent FROM user_channel_content_state WHERE userId = ? AND channelId = ?",
      args: [session.user.id, competitor.channelId],
    });

    // Если записи нет, создаём её с дефолтными значениями
    if (contentStateResult.rows.length === 0) {
      try {
        await client.execute({
          sql: `INSERT INTO user_channel_content_state (userId, channelId, hasShownContent)
                VALUES (?, ?, 0)
                ON CONFLICT(userId, channelId) DO NOTHING`,
          args: [session.user.id, competitor.channelId],
        });
        console.log("[Channel Page] Created user_channel_content_state for:", {
          userId: session.user.id,
          channelId: competitor.channelId,
        });
        // Перезапрашиваем данные после создания
        contentStateResult = await client.execute({
          sql: "SELECT hasShownContent FROM user_channel_content_state WHERE userId = ? AND channelId = ?",
          args: [session.user.id, competitor.channelId],
        });
      } catch (error) {
        console.warn("[Channel Page] Failed to create user_channel_content_state:", error);
      }
    }

    const hasShownContent = contentStateResult.rows.length > 0
      ? (contentStateResult.rows[0].hasShownContent as number) === 1
      : false;

    // Получаем состояние показа глубокого анализа комментариев для пользователя
    let deepCommentsStateResult = await client.execute({
      sql: "SELECT hasShownDeepComments FROM user_channel_deep_comments_state WHERE userId = ? AND channelId = ?",
      args: [session.user.id, competitor.channelId],
    });

    // Если записи нет, создаём её с дефолтными значениями
    if (deepCommentsStateResult.rows.length === 0) {
      try {
        await client.execute({
          sql: `INSERT INTO user_channel_deep_comments_state (userId, channelId, hasShownDeepComments)
                VALUES (?, ?, 0)
                ON CONFLICT(userId, channelId) DO NOTHING`,
          args: [session.user.id, competitor.channelId],
        });
        console.log("[Channel Page] Created user_channel_deep_comments_state for:", {
          userId: session.user.id,
          channelId: competitor.channelId,
        });
        // Перезапрашиваем данные после создания
        deepCommentsStateResult = await client.execute({
          sql: "SELECT hasShownDeepComments FROM user_channel_deep_comments_state WHERE userId = ? AND channelId = ?",
          args: [session.user.id, competitor.channelId],
        });
      } catch (error) {
        console.warn("[Channel Page] Failed to create user_channel_deep_comments_state:", error);
      }
    }

    const hasShownDeepComments = deepCommentsStateResult.rows.length > 0
      ? (deepCommentsStateResult.rows[0].hasShownDeepComments as number) === 1
      : false;

    // НОВОЕ (ИТЕРАЦИЯ 9): hasVideos теперь всегда false при SSR
    // Видео загружаются на клиенте после sync/show, поэтому проверку нельзя делать на сервере
    const hasVideos = false;

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
          hasShownMetrics={hasShownMetrics}
          hasShownMomentum={hasShownMomentum}
          hasShownAudience={hasShownAudience}
          hasShownVideos={hasShownVideos}
          hasShownContent={hasShownContent}
          hasShownDeepComments={hasShownDeepComments}
        />
      </div>
    );
  } finally {
    client.close();
  }
}
