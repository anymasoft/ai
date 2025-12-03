"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Users, Heart, MessageCircle, TrendingDown, Lightbulb, Sparkles, AlertTriangle } from "lucide-react";
import { useRouter } from "next/navigation";

interface EngagementVideo {
  title: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  engagementScore: number;
  likeRate: number;
  commentRate: number;
  viewsPerDay: number;
  publishedAt: string;
}

interface AudienceData {
  highEngagementVideos: EngagementVideo[];
  stats: {
    totalAnalyzed: number;
    highEngagement: number;
    rising: number;
    weak: number;
    medianEngagement: number;
  };
  highEngagementThemes: string[];
  engagingFormats: string[];
  audiencePatterns: string[];
  weakPoints: string[];
  recommendations: string[];
  explanation: string;
  usingFallback?: boolean;
  generatedAt?: number;
}

interface AudienceInsightsProps {
  channelId: number;
  initialData?: AudienceData | null;
  hasRequiredData?: boolean;
  analysisLanguage?: "en" | "ru";
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

function formatEngagement(score: number, isFallback: boolean): string {
  // В fallback режиме score - это большое число (viewsPerDay based)
  // В стандартном режиме score - это дробь (0.0 - 1.0)
  if (isFallback) {
    // Показываем как число без процента
    return score.toFixed(2);
  } else {
    // Умножаем на 100 для процентов
    return `${(score * 100).toFixed(3)}%`;
  }
}

export function AudienceInsights({
  channelId,
  initialData,
  hasRequiredData = true,
  analysisLanguage = "en"
}: AudienceInsightsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AudienceData | null>(initialData || null);
  const [error, setError] = useState<string | null>(null);
  const [enriching, setEnriching] = useState(false);

  // Local dictionary for titles/descriptions only
  const texts = {
    en: {
      title: "Audience & Engagement",
      description: "Audience engagement and content reactions analysis",
      generating: "Analyzing engagement...",
      waitTime: "This may take 15-25 seconds",
      syncFirst: "Sync videos first",
      syncDesc: "Click 'Sync Top Videos' above to load data.",
      generateButton: "Generate Audience Analysis",
      generateDesc: "Audience analysis will show which topics get maximum audience reactions.",
      refreshButton: "Refresh Analysis",
      statsAnalyzed: "Analyzed",
      statsHighEngagement: "High Engagement",
      statsRising: "Rising",
      statsWeak: "Weak",
      fallbackWarning: "Likes/comments data unavailable",
      fallbackDesc: "Using behavioral engagement profile based on views, growth rate, format and topic.",
      enrichButton: "Get real likes/comments",
      enriching: "Enriching data...",
      enrichWait: "This will take ~15-30 seconds. Fetching detailed data for top 30 videos...",
      whyHighEngagement: "Why these topics get high engagement",
      highEngagementThemes: "High Engagement Themes",
      engagingFormats: "Engaging Formats",
      audiencePatterns: "Audience Patterns",
      weakPoints: "Weak Points",
      weakPointsDesc: "Topics and formats that get few reactions",
      recommendations: "How to increase engagement",
      highEngagementVideos: "High Engagement Videos",
      videosAboveMedian: "Videos with engagement 50%+ above median",
      views: "views",
      likes: "likes",
      comments: "comments",
      engagement: "engagement",
      score: "score"
    },
    ru: {
      title: "Audience & Engagement",
      description: "Анализ вовлеченности аудитории и реакций на контент",
      generating: "Анализ engagement...",
      waitTime: "Это может занять 15-25 секунд",
      syncFirst: "Сначала синхронизируйте видео",
      syncDesc: "Нажмите кнопку 'Sync Top Videos' выше, чтобы загрузить данные.",
      generateButton: "Сгенерировать Audience анализ",
      generateDesc: "Audience анализ покажет какие темы получают максимум реакций от аудитории.",
      refreshButton: "Обновить анализ",
      statsAnalyzed: "Проанализировано",
      statsHighEngagement: "High Engagement",
      statsRising: "Rising",
      statsWeak: "Weak",
      fallbackWarning: "Данные лайков/комментариев недоступны",
      fallbackDesc: "Используем поведенческий engagement-профиль на основе просмотров, скорости роста, формата и темы видео.",
      enrichButton: "Получить реальные лайки/комменты",
      enriching: "Обогащение данных...",
      enrichWait: "Это займёт ~15-30 секунд. Получаем детальные данные для топ 30 видео...",
      whyHighEngagement: "Почему эти темы получают высокий engagement",
      highEngagementThemes: "Темы с высоким engagement",
      engagingFormats: "Форматы, вызывающие реакцию",
      audiencePatterns: "Паттерны аудитории",
      weakPoints: "Слабые точки",
      weakPointsDesc: "Темы и форматы, которые получают мало реакций",
      recommendations: "Рекомендации как повысить engagement",
      highEngagementVideos: "Видео с высоким Engagement",
      videosAboveMedian: "Видео с engagement выше медианы на 50%+",
      views: "просмотров",
      likes: "лайков",
      comments: "комментариев",
      engagement: "engagement",
      score: "score"
    }
  };

  const t = texts[analysisLanguage];

  async function handleGenerate() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/channel/${channelId}/audience`, {
        method: "POST",
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to generate audience analysis");
      }

      const result = await res.json();
      setData(result);

      // Обновляем страницу чтобы показать новые данные
      router.refresh();
    } catch (err) {
      console.error("Error generating audience analysis:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function handleEnrich() {
    setEnriching(true);
    setError(null);

    try {
      const res = await fetch(`/api/channel/${channelId}/videos/enrich`, {
        method: "POST",
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to enrich videos");
      }

      const result = await res.json();
      console.log('Enrichment result:', result);

      // После обогащения перегенерируем анализ
      await handleGenerate();
    } catch (err) {
      console.error("Error enriching videos:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setEnriching(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            {t.title}
          </CardTitle>
          <CardDescription>
            {t.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{t.generating}</p>
            <p className="text-sm text-muted-foreground mt-2">{t.waitTime}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            {t.title}
          </CardTitle>
          <CardDescription>
            {t.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12">
            {!hasRequiredData ? (
              <>
                <p className="text-muted-foreground mb-2 text-center">
                  {t.syncFirst}
                </p>
                <p className="text-sm text-muted-foreground mb-4 text-center">
                  {t.syncDesc}
                </p>
                <Button onClick={handleGenerate} className="gap-2 cursor-pointer" disabled title={t.syncFirst}>
                  <Users className="h-4 w-4" />
                  {t.generateButton}
                </Button>
              </>
            ) : (
              <>
                <p className="text-muted-foreground mb-4">
                  {t.generateDesc}
                </p>
                <Button onClick={handleGenerate} className="gap-2 cursor-pointer">
                  <Users className="h-4 w-4" />
                  {t.generateButton}
                </Button>
              </>
            )}
            {error && (
              <p className="text-sm text-destructive mt-4">{error}</p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            {t.title}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t.description}
          </p>
        </div>
        <Button onClick={handleGenerate} variant="outline" size="sm" className="gap-2 cursor-pointer">
          <Users className="h-4 w-4" />
          {t.refreshButton}
        </Button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="text-2xl font-bold">{data.stats.totalAnalyzed}</div>
          <div className="text-xs text-muted-foreground">{t.statsAnalyzed}</div>
        </div>
        <div className="bg-purple-500/10 rounded-lg p-4">
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{data.stats.highEngagement}</div>
          <div className="text-xs text-muted-foreground">{t.statsHighEngagement}</div>
        </div>
        <div className="bg-blue-500/10 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{data.stats.rising}</div>
          <div className="text-xs text-muted-foreground">{t.statsRising}</div>
        </div>
        <div className="bg-red-500/10 rounded-lg p-4">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">{data.stats.weak}</div>
          <div className="text-xs text-muted-foreground">{t.statsWeak}</div>
        </div>
      </div>

      {/* Fallback Warning */}
      {data.usingFallback && (
        <Card className="border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                  {t.fallbackWarning}
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1 mb-3">
                  {t.fallbackDesc}
                </p>
                <Button
                  onClick={handleEnrich}
                  disabled={enriching}
                  size="sm"
                  variant="outline"
                  className="gap-2 border-amber-400 text-amber-900 hover:bg-amber-100 dark:text-amber-100 dark:hover:bg-amber-900/20 cursor-pointer"
                >
                  {enriching ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t.enriching}
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      {t.enrichButton}
                    </>
                  )}
                </Button>
                {enriching && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                    {t.enrichWait}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Explanation */}
      <Card className="border-purple-200 dark:border-purple-900 bg-purple-50/50 dark:bg-purple-950/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            {t.whyHighEngagement}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{data.explanation}</p>
        </CardContent>
      </Card>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* High Engagement Themes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Heart className="h-5 w-5 text-pink-600 dark:text-pink-400" />
              {t.highEngagementThemes}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.highEngagementThemes.map((theme, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-pink-600 dark:text-pink-400 mt-1">♥</span>
                  <span className="text-sm">{theme}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Engaging Formats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              {t.engagingFormats}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.engagingFormats.map((format, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-green-600 dark:text-green-400 mt-1">💬</span>
                  <span className="text-sm">{format}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Audience Patterns */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              {t.audiencePatterns}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.audiencePatterns.map((pattern, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-400 mt-1">👥</span>
                  <span className="text-sm">{pattern}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Weak Points - Full Width */}
      <Card className="border-red-200 dark:border-red-900 bg-red-50/30 dark:bg-red-950/10">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
            {t.weakPoints}
          </CardTitle>
          <CardDescription>
            {t.weakPointsDesc}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {data.weakPoints.map((weak, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-red-600 dark:text-red-400 mt-1">⚠</span>
                <span className="text-sm">{weak}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Recommendations - Full Width */}
      <Card className="border-yellow-200 dark:border-yellow-900 bg-yellow-50/30 dark:bg-yellow-950/10">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            {t.recommendations}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {data.recommendations.map((rec, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-yellow-600 dark:text-yellow-400 mt-1">→</span>
                <span className="text-sm">{rec}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* High Engagement Videos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t.highEngagementVideos}</CardTitle>
          <CardDescription>
            {t.videosAboveMedian}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.highEngagementVideos.map((video, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm line-clamp-1">{video.title}</div>
                  <div className="text-xs text-muted-foreground mt-1 flex gap-3">
                    <span>{formatNumber(video.viewCount)} {t.views}</span>
                    <span>{formatNumber(video.likeCount)} {t.likes}</span>
                    <span>{formatNumber(video.commentCount)} {t.comments}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <div className="text-right">
                    <div className="text-sm font-bold text-purple-600 dark:text-purple-400">
                      {formatEngagement(video.engagementScore, data.usingFallback || false)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {data.usingFallback ? t.score : t.engagement}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {data.generatedAt && (
        <p className="text-xs text-muted-foreground text-center">
          Analysis generated: {new Date(data.generatedAt).toLocaleString("en-US")}
        </p>
      )}
    </div>
  );
}
