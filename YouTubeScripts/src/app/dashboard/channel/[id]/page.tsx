import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createClient } from "@libsql/client";
import { db } from "@/lib/db";
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
    redirect("/sign-in");
  }

  const { id } = await params;
  const competitorId = parseInt(id, 10);

  if (!Number.isFinite(competitorId) || competitorId <= 0) {
    redirect("/competitors");
  }

  // Получаем текущий тариф из БД
  const userResult = await db.execute(
    "SELECT plan FROM users WHERE id = ?",
    [session.user.id]
  );
  const userRows = Array.isArray(userResult) ? userResult : userResult.rows || [];
  const userPlan = (userRows[0]?.plan || "free") as "free" | "basic" | "professional" | "enterprise";

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

    // ПРИМЕЧАНИЕ (ЭТАП 4): Старая логика user_channel_state для видео удалена
    // user_channel_state теперь используется ТОЛЬКО для аналитики (audience, momentum, content)
    // Для топ-видео больше не нужны флаги hasSyncedTopVideos и hasShownVideos

    // НОВОЕ (ИТЕРАЦИЯ 9): hasVideos теперь всегда false при SSR
    // Видео загружаются на клиенте после sync/show, поэтому проверку нельзя делать на сервере
    const hasVideos = false;

    // Получаем Content Intelligence анализ
    const intelligenceResult = await client.execute({
      sql: "SELECT * FROM content_intelligence WHERE channelId = ? ORDER BY generatedAt DESC LIMIT 1",
      args: [competitor.channelId],
    });

    const intelligence = intelligenceResult.rows.length > 0 ? intelligenceResult.rows[0] as any : null;

    // Парсим JSON данные из content_intelligence
    const contentData = intelligence ? JSON.parse(intelligence.data as string) : null;

    // Получаем Анализ роста анализ
    const momentumResult = await client.execute({
      sql: "SELECT * FROM momentum_insights WHERE channelId = ? ORDER BY generatedAt DESC LIMIT 1",
      args: [competitor.channelId],
    });

    const momentum = momentumResult.rows.length > 0 ? momentumResult.rows[0] as any : null;

    // Парсим JSON данные из momentum_insights
    const momentumData = momentum ? JSON.parse(momentum.data as string) : null;

    // Получаем Анализ аудитории анализ
    const audienceResult = await client.execute({
      sql: "SELECT * FROM audience_insights WHERE channelId = ? ORDER BY generatedAt DESC LIMIT 1",
      args: [competitor.channelId],
    });

    const audience = audienceResult.rows.length > 0 ? audienceResult.rows[0] as any : null;

    // Парсим JSON данные из audience_insights
    const audienceData = audience ? JSON.parse(audience.data as string) : null;

    // Получаем Comment Insights анализ пользователя
    const commentsResult = await client.execute({
      sql: "SELECT * FROM comment_insights WHERE userId = ? AND channelId = ? ORDER BY generatedAt DESC LIMIT 1",
      args: [session.user.id, competitor.channelId],
    });

    const comments = commentsResult.rows.length > 0 ? commentsResult.rows[0] as any : null;

    // Парсим JSON данные из comment_insights
    let commentsData = null;
    if (comments) {
      try {
        commentsData = JSON.parse(comments.data as string);
        console.log("[ChannelPage] Comment Insights парсен успешно:", {
          hasStats: !!commentsData.stats,
          audienceInterestsLength: commentsData.audienceInterests?.length || 0,
          complaintsLength: commentsData.complaints?.length || 0,
          praisesLength: commentsData.praises?.length || 0,
          generatedAt: comments.generatedAt,
        });
      } catch (parseErr) {
        console.error("[ChannelPage] Ошибка парсинга comment_insights JSON:", parseErr);
        console.log("[ChannelPage] Raw comments.data:", comments.data);
      }
    }

    // Получаем Deep Comment Analysis (AI v2.0)
    const deepAnalysisResult = await client.execute({
      sql: "SELECT * FROM channel_ai_comment_insights WHERE channelId = ? ORDER BY createdAt DESC LIMIT 1",
      args: [competitor.channelId],
    });

    const deepAnalysis = deepAnalysisResult.rows.length > 0 ? deepAnalysisResult.rows[0] as any : null;

    // Парсим JSON данные из channel_ai_comment_insights
    const deepAnalysisData = deepAnalysis ? JSON.parse(deepAnalysis.resultJson as string) : null;

    // НОВОЕ (ИТЕРАЦИЯ 9): hasComments также всегда false при SSR
    // Комментарии проверяются на клиенте после загрузки видео
    const hasComments = false;

    // Debug: проверка channelId и количества метрик
    console.log("[ChannelPage] Загруженные данные для канала:", competitor.channelId);

    console.log("[ChannelPage] Metrics count - videos:", videos.length);
    console.log("[ChannelPage] Content Intelligence:", contentData ? "exists" : "not found");
    if (contentData) {
      console.log("[ChannelPage] ContentData format:", contentData.format || "json (old format)");
      console.log("[ChannelPage] ContentData has report:", !!contentData.report);
    }
    console.log("[ChannelPage] Анализ роста:", momentumData ? "exists" : "not found");
    console.log("[ChannelPage] Анализ аудитории:", audienceData ? "exists" : "not found");
    console.log("[ChannelPage] Comment Insights:", commentsData ? "exists" : "not found", {
      hasStats: !!commentsData?.stats,
      interestsCount: commentsData?.audienceInterests?.length || 0,
    });
    console.log("[ChannelPage] Deep Analysis:", deepAnalysisData ? "exists" : "not found");

    return (
      <div className="container mx-auto px-4 md:px-6 space-y-6 pb-12">
        {/* Back button */}
        <div className="pt-6">
          <Link
            href="/dashboard/competitors"
            className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Вернуться к конкурентам
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
              href={(() => {
                const handle = (competitor.handle as string) || '';
                // Если это полный URL, используем как есть
                if (handle.startsWith('http')) {
                  // Если URL не содержит "@", добавляем его перед handle
                  if (handle.includes('youtube.com/') && !handle.includes('youtube.com/@')) {
                    return handle.replace('youtube.com/', 'youtube.com/@');
                  }
                  return handle;
                }
                // Если это просто handle, добавляем "@" если его нет
                const cleanHandle = handle.startsWith('@') ? handle.substring(1) : handle;
                return `https://www.youtube.com/@${cleanHandle}`;
              })()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-blue-600 text-sm hover:underline dark:text-blue-400"
            >
              Смотреть на YouTube
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Метрики в строку */}
        <div className="flex items-center gap-6 text-sm flex-wrap">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">{formatNumber(competitor.subscriberCount as number)}</span>
            <span className="text-muted-foreground">подписчиков</span>
          </div>
          <div className="flex items-center gap-2">
            <Video className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">{formatNumber(competitor.videoCount as number)}</span>
            <span className="text-muted-foreground">видео</span>
          </div>
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">{formatNumber(competitor.viewCount as number)}</span>
            <span className="text-muted-foreground">просмотров</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Обновлено: {formatDate(competitor.lastSyncedAt as number)}</span>
          </div>
        </div>

        <Separator />

        {/* Обзор - Ключевые метрики */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Обзор</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border rounded-lg p-4 bg-muted/40">
              <div className="text-sm text-muted-foreground mb-2">Подписчики</div>
              <div className="text-3xl font-bold">{formatNumber(competitor.subscriberCount as number)}</div>
            </div>

            <div className="border rounded-lg p-4 bg-muted/40">
              <div className="text-sm text-muted-foreground mb-2">Всего просмотров</div>
              <div className="text-3xl font-bold">{formatNumber(competitor.viewCount as number)}</div>
            </div>

            <div className="border rounded-lg p-4 bg-muted/40">
              <div className="text-sm text-muted-foreground mb-2">Среднее просмотров на видео</div>
              <div className="text-3xl font-bold">{formatNumber(avgViews)}</div>
            </div>
          </div>
        </div>

      {/* AI SWOT Analysis */}
      <SWOTAnalysisBlock
        competitorId={competitorId}
        channelId={competitor.channelId as string}
        insight={insight}
      />

        {/* Analytics Section */}
        <ChannelAnalytics
          competitorId={competitorId}
          channelId={competitor.channelId as string}
          videos={videos}
          contentData={contentData && intelligence ? { ...contentData, generatedAt: intelligence.generatedAt } : null}
          momentumData={momentumData && momentum ? { ...momentumData, generatedAt: momentum.generatedAt } : null}
          audienceData={audienceData && audience ? { ...audienceData, generatedAt: audience.generatedAt } : null}
          commentsData={commentsData && comments ? { ...commentsData, generatedAt: comments.generatedAt } : null}
          deepAnalysisData={deepAnalysisData && deepAnalysis ? { ...deepAnalysisData, createdAt: deepAnalysis.createdAt } : null}
          hasVideos={hasVideos}
          hasComments={hasComments}
          userPlan={userPlan}
        />
      </div>
    );
  } finally {
    client.close();
  }
}
