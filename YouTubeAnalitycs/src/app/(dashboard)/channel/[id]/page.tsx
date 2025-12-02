import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, competitors, aiInsights, channelMetrics, channelVideos, contentIntelligence } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { TrendingUp, Users, Video, Eye, BarChart3, Calendar, AlertCircle, ArrowLeft, ExternalLink } from "lucide-react";
import { SyncMetricsButton } from "@/components/channel/SyncMetricsButton";
import { SyncVideosButton } from "@/components/channel/SyncVideosButton";
import { ChannelGrowthChart } from "@/components/charts/ChannelGrowthChart";
import { TopVideosGrid } from "@/components/channel/TopVideosGrid";
import { ContentIntelligenceBlock } from "@/components/channel/ContentIntelligenceBlock";

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

/**
 * Компонент-плейсхолдер для будущих блоков аналитики
 */
function PlaceholderSection({ title, icon: Icon }: { title: string; icon: any }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-muted-foreground" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <p>Coming soon: data-driven analysis</p>
        </div>
      </CardContent>
    </Card>
  );
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

  // Debug: проверка channelId и количества метрик
  console.log("channelId:", competitor.channelId);
  console.log("metrics rows:", metrics.length);
  console.log("videos rows:", videos.length);
  console.log("content intelligence:", contentData ? "exists" : "not found");

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
            View on YouTube
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Кнопки синхронизации метрик и видео */}
        <div className="self-start flex gap-2">
          <SyncMetricsButton channelId={competitorId} />
          <SyncVideosButton channelId={competitorId} />
        </div>
      </div>

      {/* Метрики в строку */}
      <div className="flex items-center gap-6 text-sm flex-wrap">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold">{formatNumber(competitor.subscriberCount)}</span>
          <span className="text-muted-foreground">подписчиков</span>
        </div>
        <div className="flex items-center gap-2">
          <Video className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold">{formatNumber(competitor.videoCount)}</span>
          <span className="text-muted-foreground">видео</span>
        </div>
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold">{formatNumber(competitor.viewCount)}</span>
          <span className="text-muted-foreground">просмотров</span>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">Обновлено: {formatDate(competitor.lastSyncedAt)}</span>
        </div>
      </div>

      <Separator />

      {/* Overview - Ключевые метрики */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border rounded-lg p-4 bg-muted/40">
            <div className="text-sm text-muted-foreground mb-2">Подписчики</div>
            <div className="text-3xl font-bold">{formatNumber(competitor.subscriberCount)}</div>
          </div>

          <div className="border rounded-lg p-4 bg-muted/40">
            <div className="text-sm text-muted-foreground mb-2">Всего просмотров</div>
            <div className="text-3xl font-bold">{formatNumber(competitor.viewCount)}</div>
          </div>

          <div className="border rounded-lg p-4 bg-muted/40">
            <div className="text-sm text-muted-foreground mb-2">Средние просмотры на видео</div>
            <div className="text-3xl font-bold">{formatNumber(avgViews)}</div>
          </div>
        </div>
      </div>

      {/* AI Insights */}
      <div>
        <h2 className="text-2xl font-bold mb-4">AI Insights</h2>
        {insight ? (
          <div className="space-y-4">
            {/* Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Краткая сводка</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{insight.summary}</p>
                <p className="text-xs text-muted-foreground mt-4">
                  Анализ сгенерирован: {formatDate(insight.createdAt)}
                </p>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Strengths */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg text-green-600 dark:text-green-500">
                    Сильные стороны
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
                    Слабые стороны
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
                    Возможности
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
                    Угрозы
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
                  Рекомендации
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
              Нет доступного AI-анализа. Анализ будет генерироваться автоматически при наличии достаточных данных.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Графики аналитики */}
      <div className="space-y-6">
        {/* Реальный график роста с timeseries данными */}
        <ChannelGrowthChart
          metrics={metrics}
          title="Growth Over Time"
          description="Historical metrics showing channel growth trends"
        />

        {/* Топ видео канала */}
        <TopVideosGrid videos={videos} />

        {/* AI Content Intelligence */}
        <ContentIntelligenceBlock
          channelId={competitorId}
          initialData={contentData ? { ...contentData, generatedAt: intelligence?.generatedAt } : null}
        />

        {/* Будущие блоки */}
        <PlaceholderSection title="Audience & Engagement" icon={Users} />
      </div>
    </div>
  );
}
