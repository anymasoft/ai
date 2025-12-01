import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, competitors, aiInsights } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { TrendingUp, Users, Video, Eye, BarChart3, Calendar, AlertCircle } from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Форматирует числа для читаемости (1000000 → 1M)
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

  return (
    <div className="container mx-auto px-4 md:px-6 space-y-6 pb-12">
      {/* Хедер канала */}
      <div className="flex items-start gap-6 pt-6">
        <Avatar className="h-24 w-24">
          <AvatarImage src={competitor.avatarUrl || undefined} alt={competitor.title} />
          <AvatarFallback className="text-2xl">
            {competitor.title.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">{competitor.title}</h1>
            <Badge variant="secondary">{competitor.platform}</Badge>
          </div>
          <p className="text-lg text-muted-foreground mb-3">{competitor.handle}</p>

          <div className="flex items-center gap-6 text-sm">
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
          </div>

          <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>Последнее обновление: {formatDate(competitor.lastSyncedAt)}</span>
          </div>
        </div>
      </div>

      <Separator />

      {/* Overview - Ключевые метрики */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Подписчики</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatNumber(competitor.subscriberCount)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Всего просмотров</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatNumber(competitor.viewCount)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Средние просмотры на видео</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatNumber(avgViews)}</div>
            </CardContent>
          </Card>
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
                <CardTitle className="text-lg">📊 Краткая сводка</CardTitle>
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
                    💪 Сильные стороны
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
                    ⚠️ Слабые стороны
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
                    🚀 Возможности
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
                    ⚡ Угрозы
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
                  💡 Рекомендации
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

      {/* Будущие блоки аналитики */}
      <div className="space-y-6">
        <PlaceholderSection title="Growth Over Time" icon={TrendingUp} />
        <PlaceholderSection title="Top Videos" icon={Video} />
        <PlaceholderSection title="Content Patterns" icon={BarChart3} />
        <PlaceholderSection title="Audience & Engagement" icon={Users} />
      </div>
    </div>
  );
}
