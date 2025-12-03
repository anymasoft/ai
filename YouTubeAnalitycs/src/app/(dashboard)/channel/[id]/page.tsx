import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserLanguageServer } from "@/lib/get-user-language-server";
import { getDict } from "@/lib/i18n";
import { db, competitors, aiInsights, channelMetrics, channelVideos, videoComments, contentIntelligence, momentumInsights, audienceInsights, commentInsights, channelAICommentInsights } from "@/lib/db";
import { eq, and, desc, inArray } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { TrendingUp, Users, Video, Eye, BarChart3, Calendar, AlertCircle, ArrowLeft, ExternalLink } from "lucide-react";
import { SyncMetricsButton } from "@/components/channel/SyncMetricsButton";
import { SyncVideosButton } from "@/components/channel/SyncVideosButton";
import { SyncCommentsButton } from "@/components/channel/SyncCommentsButton";
import { SyncAllDataButton } from "@/components/channel/SyncAllDataButton";
import { ChannelGrowthChart } from "@/components/charts/ChannelGrowthChart";
import { TopVideosGrid } from "@/components/channel/TopVideosGrid";
import { ContentIntelligenceBlock } from "@/components/channel/ContentIntelligenceBlock";
import { MomentumInsights } from "@/components/channel/MomentumInsights";
import { AudienceInsights } from "@/components/channel/AudienceInsights";
import { CommentInsights } from "@/components/channel/CommentInsights";
import { DeepCommentAnalysis } from "@/components/channel/DeepCommentAnalysis";

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
  return new Date(timestamp).toLocaleDateString("ru-RU", {
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

  // Получаем язык пользователя и словарь для локализации
  const language = await getUserLanguageServer();
  const dict = getDict(language);

  const { id } = await params;
  const competitorId = parseInt(id, 10);

  if (!Number.isFinite(competitorId) || competitorId <= 0) {
    redirect("/competitors");
  }

  // Получаем данные канала из БД
  const competitor = await db
    .select()
    .from(competitors)
    .where(
      and(
        eq(competitors.id, competitorId),
        eq(competitors.userId, session.user.id)
      )
    )
    .get();

  // Если канал не найден или не принадлежит пользователю
  if (!competitor) {
    redirect("/competitors");
  }

  // Получаем AI-анализ (если есть)
  const aiInsight = await db
    .select()
    .from(aiInsights)
    .where(eq(aiInsights.competitorId, competitorId))
    .orderBy(desc(aiInsights.createdAt))
    .limit(1)
    .get();

  // Парсим JSON данные из ai_insights
  const insight = aiInsight
    ? {
        summary: aiInsight.summary,
        strengths: JSON.parse(aiInsight.strengths) as string[],
        weaknesses: JSON.parse(aiInsight.weaknesses) as string[],
        opportunities: JSON.parse(aiInsight.opportunities) as string[],
        threats: JSON.parse(aiInsight.threats) as string[],
        recommendations: JSON.parse(aiInsight.recommendations) as string[],
        createdAt: aiInsight.createdAt,
      }
    : null;

  const avgViews = calculateAvgViews(competitor.viewCount, competitor.videoCount);

  // Получаем исторические метрики для графиков
  const metrics = await db
    .select()
    .from(channelMetrics)
    .where(eq(channelMetrics.channelId, competitor.channelId))
    .orderBy(channelMetrics.fetchedAt)
    .all();

  // Получаем топ видео канала
  const videos = await db
    .select()
    .from(channelVideos)
    .where(eq(channelVideos.channelId, competitor.channelId))
    .orderBy(desc(channelVideos.viewCount))
    .all();

  // Проверяем наличие данных для AI-модулей
  const hasVideos = videos.length > 0;

  // Проверяем наличие комментариев (если есть видео)
  let hasComments = false;
  if (hasVideos) {
    const videoIds = videos.map(v => v.videoId);
    const commentSample = await db
      .select()
      .from(videoComments)
      .where(inArray(videoComments.videoId, videoIds))
      .limit(1)
      .all();
    hasComments = commentSample.length > 0;
  }

  // Получаем Content Intelligence анализ
  const intelligence = await db
    .select()
    .from(contentIntelligence)
    .where(eq(contentIntelligence.channelId, competitor.channelId))
    .orderBy(desc(contentIntelligence.generatedAt))
    .limit(1)
    .get();

  // Парсим JSON данные из content_intelligence
  const contentData = intelligence ? JSON.parse(intelligence.data) : null;

  // Получаем Momentum Insights анализ
  const momentum = await db
    .select()
    .from(momentumInsights)
    .where(eq(momentumInsights.channelId, competitor.channelId))
    .orderBy(desc(momentumInsights.generatedAt))
    .limit(1)
    .get();

  // Парсим JSON данные из momentum_insights
  const momentumData = momentum ? JSON.parse(momentum.data) : null;

  // Получаем Audience Insights анализ
  const audience = await db
    .select()
    .from(audienceInsights)
    .where(eq(audienceInsights.channelId, competitor.channelId))
    .orderBy(desc(audienceInsights.generatedAt))
    .limit(1)
    .get();

  // Парсим JSON данные из audience_insights
  const audienceData = audience ? JSON.parse(audience.data) : null;

  // Получаем Comment Insights анализ
  const comments = await db
    .select()
    .from(commentInsights)
    .where(eq(commentInsights.channelId, competitor.channelId))
    .orderBy(desc(commentInsights.generatedAt))
    .limit(1)
    .get();

  // Парсим JSON данные из comment_insights
  const commentsData = comments ? JSON.parse(comments.data) : null;

  // Получаем Deep Comment Analysis (AI v2.0)
  const deepAnalysis = await db
    .select()
    .from(channelAICommentInsights)
    .where(eq(channelAICommentInsights.channelId, competitor.channelId))
    .orderBy(desc(channelAICommentInsights.createdAt))
    .limit(1)
    .get();

  // Парсим JSON данные из channel_ai_comment_insights
  const deepAnalysisData = deepAnalysis ? JSON.parse(deepAnalysis.resultJson) : null;

  // Debug: проверка channelId и количества метрик
  console.log("channelId:", competitor.channelId);
  console.log("metrics rows:", metrics.length);
  console.log("videos rows:", videos.length);
  console.log("content intelligence:", contentData ? "exists" : "not found");
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
          {dict.backToCompetitors}
        </Link>
      </div>

      {/* Хедер канала */}
      <div className="flex items-center gap-4">
        <img
          src={competitor.avatarUrl || "/placeholder.png"}
          alt={competitor.title}
          className="w-20 h-20 rounded-full object-cover border-2 border-border"
        />

        <div className="flex-1">
          <h1 className="text-2xl font-semibold mb-1">{competitor.title}</h1>

          <div className="text-sm text-muted-foreground mb-1">
            {competitor.handle}
          </div>

          <a
            href={competitor.handle.startsWith('http') ? competitor.handle : `https://www.youtube.com/${competitor.handle}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-blue-600 text-sm hover:underline dark:text-blue-400"
          >
            {dict.viewOnYoutube}
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Кнопки синхронизации метрик, видео и комментариев */}
        <div className="self-start flex gap-2">
          <SyncAllDataButton channelId={competitorId} />
          <SyncMetricsButton channelId={competitorId} />
          <SyncVideosButton channelId={competitorId} />
          <SyncCommentsButton channelId={competitorId} />
        </div>
      </div>

      {/* Метрики в строку */}
      <div className="flex items-center gap-6 text-sm flex-wrap">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold">{formatNumber(competitor.subscriberCount)}</span>
          <span className="text-muted-foreground">{dict.subscribers}</span>
        </div>
        <div className="flex items-center gap-2">
          <Video className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold">{formatNumber(competitor.videoCount)}</span>
          <span className="text-muted-foreground">{dict.videos}</span>
        </div>
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold">{formatNumber(competitor.viewCount)}</span>
          <span className="text-muted-foreground">{dict.views}</span>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">{dict.updatedAt}: {formatDate(competitor.lastSyncedAt)}</span>
        </div>
      </div>

      <Separator />

      {/* Overview - Ключевые метрики */}
      <div>
        <h2 className="text-2xl font-bold mb-4">{dict.overview}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border rounded-lg p-4 bg-muted/40">
            <div className="text-sm text-muted-foreground mb-2">{dict.overviewSubscribers}</div>
            <div className="text-3xl font-bold">{formatNumber(competitor.subscriberCount)}</div>
          </div>

          <div className="border rounded-lg p-4 bg-muted/40">
            <div className="text-sm text-muted-foreground mb-2">{dict.overviewTotalViews}</div>
            <div className="text-3xl font-bold">{formatNumber(competitor.viewCount)}</div>
          </div>

          <div className="border rounded-lg p-4 bg-muted/40">
            <div className="text-sm text-muted-foreground mb-2">{dict.avgViewsPerVideo}</div>
            <div className="text-3xl font-bold">{formatNumber(avgViews)}</div>
          </div>
        </div>
      </div>

      {/* AI Insights */}
      <div>
        <h2 className="text-2xl font-bold mb-4">{dict.aiInsights}</h2>
        {insight ? (
          <div className="space-y-4">
            {/* Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{dict.briefSummary}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{insight.summary}</p>
                <p className="text-xs text-muted-foreground mt-4">
                  {dict.analysisGenerated}: {formatDate(insight.createdAt)}
                </p>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Strengths */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg text-green-600 dark:text-green-500">
                    {dict.strengths}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {insight.strengths.map((strength, idx) => (
                      <li key={idx} className="text-muted-foreground">
                        {strength}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Weaknesses */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg text-red-600 dark:text-red-500">
                    {dict.weaknesses}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {insight.weaknesses.map((weakness, idx) => (
                      <li key={idx} className="text-muted-foreground">
                        {weakness}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Opportunities */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg text-blue-600 dark:text-blue-500">
                    {dict.opportunities}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {insight.opportunities.map((opportunity, idx) => (
                      <li key={idx} className="text-muted-foreground">
                        {opportunity}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Threats */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg text-orange-600 dark:text-orange-500">
                    {dict.threats}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {insight.threats.map((threat, idx) => (
                      <li key={idx} className="text-muted-foreground">
                        {threat}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Recommendations */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-purple-600 dark:text-purple-500">
                  {dict.recommendations}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {insight.recommendations.map((rec, idx) => (
                    <li key={idx} className="text-muted-foreground">
                      {rec}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {dict.noAIAnalysis}
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Графики аналитики */}
      <div className="space-y-6">
        {/* Реальный график роста с timeseries данными */}
        <ChannelGrowthChart
          metrics={metrics}
          title={dict.growthOverTime}
          description={dict.historicalMetrics}
        />

        {/* Топ видео канала */}
        <TopVideosGrid videos={videos} />

        {/* AI Content Intelligence */}
        <ContentIntelligenceBlock
          channelId={competitorId}
          initialData={contentData ? { ...contentData, generatedAt: intelligence?.generatedAt } : null}
          hasRequiredData={hasVideos}
        />

        {/* Momentum Insights */}
        <MomentumInsights
          channelId={competitorId}
          initialData={momentumData ? { ...momentumData, generatedAt: momentum?.generatedAt } : null}
          hasRequiredData={hasVideos}
        />

        {/* Audience & Engagement */}
        <AudienceInsights
          channelId={competitorId}
          initialData={audienceData ? { ...audienceData, generatedAt: audience?.generatedAt } : null}
          hasRequiredData={hasVideos}
        />

        {/* Comment Intelligence */}
        <CommentInsights
          channelId={competitorId}
          initialData={commentsData ? { ...commentsData, generatedAt: comments?.generatedAt } : null}
          hasRequiredData={hasVideos && hasComments}
        />

        {/* Deep Comment Analysis (AI v2.0) */}
        <DeepCommentAnalysis
          channelId={competitorId}
          initialData={deepAnalysisData ? { ...deepAnalysisData, createdAt: deepAnalysis?.createdAt } : null}
          hasRequiredData={hasVideos && hasComments}
        />
      </div>
    </div>
  );
}
