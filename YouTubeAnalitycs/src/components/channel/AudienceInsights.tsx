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
  hasRussianVersion?: boolean;
}

interface AudienceInsightsProps {
  channelId: number;
  initialData?: AudienceData | null;
  hasRequiredData?: boolean;
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
  hasRequiredData = true
}: AudienceInsightsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<AudienceData | null>(initialData || null);
  const [error, setError] = useState<string | null>(null);
  const [enriching, setEnriching] = useState(false);
  const [translating, setTranslating] = useState(false);

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

  async function handleTranslate() {
    setTranslating(true);
    setError(null);

    try {
      console.log('[AudienceInsights] Starting translation for channel:', channelId);
      const res = await fetch(`/api/channel/${channelId}/audience/translate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // ✅ Важно: отправляем cookies с session
        body: JSON.stringify({ targetLanguage: "ru" }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        console.error('[AudienceInsights] Translation failed:', errorData);
        throw new Error(errorData.error || "Failed to translate analysis");
      }

      const result = await res.json();
      console.log('[AudienceInsights] Translation successful, cached:', result.cached);

      // После успешного перевода получаем обновленные данные
      const getRes = await fetch(`/api/channel/${channelId}/audience`, {
        method: "GET",
        credentials: "include",
      });

      if (!getRes.ok) {
        throw new Error("Failed to fetch updated analysis");
      }

      const updatedData = await getRes.json();
      console.log('[AudienceInsights] Updated data fetched, hasRussianVersion:', updatedData.hasRussianVersion);

      // Обновляем локальный state
      setData(updatedData);
    } catch (err) {
      console.error("Error translating audience analysis:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setTranslating(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            Audience & Engagement
          </CardTitle>
          <CardDescription>
            Audience engagement and content reactions analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Analyzing engagement...</p>
            <p className="text-sm text-muted-foreground mt-2">This may take 15-25 seconds</p>
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
            Audience & Engagement
          </CardTitle>
          <CardDescription>
            Audience engagement and content reactions analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12">
            {!hasRequiredData ? (
              <>
                <p className="text-muted-foreground mb-2 text-center">
                  Sync videos first
                </p>
                <p className="text-sm text-muted-foreground mb-4 text-center">
                  Click 'Sync Top Videos' above to load data.
                </p>
                <Button onClick={handleGenerate} className="gap-2 cursor-pointer" disabled title="Sync videos first">
                  <Users className="h-4 w-4" />
                  Generate Audience Analysis
                </Button>
              </>
            ) : (
              <>
                <p className="text-muted-foreground mb-4">
                  Audience analysis will show which topics get maximum audience reactions.
                </p>
                <Button onClick={handleGenerate} className="gap-2 cursor-pointer">
                  <Users className="h-4 w-4" />
                  Generate Audience Analysis
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

  // Выбираем data_ru или data для отображения
  let displayData = data;

  if (data) {
    try {
      // Парсим английскую версию
      const enData = (data as any).data ? JSON.parse((data as any).data) : null;

      // Парсим русскую версию если есть
      const ruData = (data as any).data_ru ? JSON.parse((data as any).data_ru) : null;

      // Если есть русская версия - показываем её, иначе английскую
      displayData = ruData ?? enData;
    } catch (err) {
      console.error('[AudienceInsights] Failed to parse analysis data:', err);
      // Используем data как fallback
      displayData = data;
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            Audience & Engagement
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Audience engagement and content reactions analysis
          </p>
        </div>
        <div className="flex gap-2">
          {!(data as any)?.data_ru && (
            <Button
              onClick={handleTranslate}
              disabled={translating}
              variant="outline"
              size="sm"
              className="gap-2 cursor-pointer"
            >
              {translating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Translating...
                </>
              ) : (
                <>
                  🇷🇺 Translate to Russian
                </>
              )}
            </Button>
          )}
          <Button onClick={handleGenerate} variant="outline" size="sm" className="gap-2 cursor-pointer">
            <Users className="h-4 w-4" />
            Refresh Analysis
          </Button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="text-2xl font-bold">{displayData.stats.totalAnalyzed}</div>
          <div className="text-xs text-muted-foreground">Analyzed</div>
        </div>
        <div className="bg-purple-500/10 rounded-lg p-4">
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{displayData.stats.highEngagement}</div>
          <div className="text-xs text-muted-foreground">High Engagement</div>
        </div>
        <div className="bg-blue-500/10 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{displayData.stats.rising}</div>
          <div className="text-xs text-muted-foreground">Rising</div>
        </div>
        <div className="bg-red-500/10 rounded-lg p-4">
          <div className="text-2xl font-bold text-red-600 dark:text-red-400">{displayData.stats.weak}</div>
          <div className="text-xs text-muted-foreground">Weak</div>
        </div>
      </div>

      {/* Fallback Warning */}
      {displayData.usingFallback && (
        <Card className="border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                  Likes/comments data unavailable
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1 mb-3">
                  Using behavioral engagement profile based on views, growth rate, format and topic.
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
                      Enriching data...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Get real likes/comments
                    </>
                  )}
                </Button>
                {enriching && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                    This will take ~15-30 seconds. Fetching detailed data for top 30 videos...
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
            Why these topics get high engagement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{displayData.explanation}</p>
        </CardContent>
      </Card>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* High Engagement Themes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Heart className="h-5 w-5 text-pink-600 dark:text-pink-400" />
              High Engagement Themes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {displayData.highEngagementThemes.map((theme, idx) => (
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
              Engaging Formats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {displayData.engagingFormats.map((format, idx) => (
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
              Audience Patterns
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {displayData.audiencePatterns.map((pattern, idx) => (
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
            Weak Points
          </CardTitle>
          <CardDescription>
            Topics and formats that get few reactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {displayData.weakPoints.map((weak, idx) => (
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
            How to increase engagement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {displayData.recommendations.map((rec, idx) => (
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
          <CardTitle className="text-lg">High Engagement Videos</CardTitle>
          <CardDescription>
            Videos with engagement 50%+ above median
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {displayData.highEngagementVideos.map((video, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm line-clamp-1">{video.title}</div>
                  <div className="text-xs text-muted-foreground mt-1 flex gap-3">
                    <span>{formatNumber(video.viewCount)} views</span>
                    <span>{formatNumber(video.likeCount)} likes</span>
                    <span>{formatNumber(video.commentCount)} comments</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <div className="text-right">
                    <div className="text-sm font-bold text-purple-600 dark:text-purple-400">
                      {formatEngagement(video.engagementScore, displayData.usingFallback || false)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {displayData.usingFallback ? "score" : "engagement"}
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
