"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, Users, Heart, MessageCircle, TrendingDown, Lightbulb, Sparkles, AlertTriangle, Users2, Brain, Zap, RefreshCcw } from "lucide-react";
import { AnalysisLoadingState } from "@/components/ui/AnalysisLoadingState";
import { useRouter } from "next/navigation";
import { useAnalysisProgressStore } from "@/store/analysisProgressStore";
import { useGenerationStatusStore } from "@/store/generationStatusStore";

interface EngagementVideo {
  title: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  engagementScore: number;
  likeRate: number;
  commentRate: number;
  viewsPerDay: number;
  publishDate: string;
}

interface AudienceData {
  highEngagementVideos?: EngagementVideo[];
  stats?: {
    totalAnalyzed: number;
    highEngagement: number;
    rising: number;
    weak: number;
    medianEngagement: number;
  };
  // Новая структура (v2.0)
  audienceProfile?: string;
  motivations?: string[];
  segments?: string[];
  contentPatterns?: string[];
  antiPatterns?: string[];
  behavioralAnalytics?: string[];
  growthOpportunities?: string[];
  actionableRecommendations?: string[];
  // Старая структура (для обратной совместимости)
  highEngagementThemes?: string[];
  engagingFormats?: string[];
  audiencePatterns?: string[];
  weakPoints?: string[];
  recommendations?: string[];
  explanation?: string;
  usingFallback?: boolean;
  generatedAt?: number;
}

interface AudienceInsightsProps {
  competitorId: number;
  channelId: string;
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
  if (isFallback) {
    return score.toFixed(2);
  } else {
    return `${(score * 100).toFixed(3)}%`;
  }
}

/**
 * Проверяет есть ли новая структура данных (v2.0)
 * Если есть audienceProfile или motivations - это новая структура
 */
function isNewFormatData(data: AudienceData | null | undefined): boolean {
  if (!data) return false;
  return !!(data.audienceProfile || data.motivations);
}

/**
 * Проверяет есть ли старая структура данных
 * Если есть highEngagementThemes или engagingFormats - это старая структура
 */
function isOldFormatData(data: AudienceData | null | undefined): boolean {
  if (!data) return false;
  return !!(data.highEngagementThemes || data.engagingFormats);
}

export function AudienceInsights({
  competitorId,
  channelId,
  initialData,
  hasRequiredData = true
}: AudienceInsightsProps) {
  const router = useRouter();
  const { start, finish, isGenerating } = useAnalysisProgressStore();
  const isEnrichingAudience = isGenerating(channelId, 'audience');
  const { getStatus, setStatus } = useGenerationStatusStore();
  const generationKey = `${competitorId}:audience-detail`;
  const loading = getStatus(generationKey) === "loading";
  const [data, setData] = useState<AudienceData | null>(initialData || null);
  const [error, setError] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const COOLDOWN_MS = 86400000; // TODO: заменить на значение из API meta.cooldown.nextAllowedAt

  const getCooldownTimeRemaining = () => {
    if (!cooldownUntil) return null;
    const remaining = cooldownUntil - Date.now();
    if (remaining <= 0) {
      setCooldownUntil(null);
      return null;
    }
    const hours = Math.floor(remaining / 3600000);
    const minutes = Math.floor((remaining % 3600000) / 60000);
    return { hours, minutes };
  };

  const isCooldownActive = cooldownUntil && Date.now() < cooldownUntil;

  async function handleGenerate() {
    setStatus(generationKey, "loading");
    setError(null);

    try {
      const res = await fetch(`/api/channel/${channelId}/audience`, {
        method: "POST",
      });

      if (!res.ok) {
        const errorData = await res.json();
        setStatus(generationKey, "error");
        throw new Error(errorData.error || "Failed to generate audience analysis");
      }

      const result = await res.json();
      setData(result);
      setStatus(generationKey, "success");

      // Обновляем страницу чтобы показать новые данные
      router.refresh();
    } catch (err) {
      console.error("Error generating audience analysis:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setStatus(generationKey, "error");
    }
  }

  async function handleEnrich() {
    start(channelId, 'audience');
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
      finish(channelId, 'audience');
    }
  }

  if (loading) {
    return (
      <AnalysisLoadingState
        title="Generating audience analysis..."
        subtitle="This may take 20-30 seconds"
      />
    );
  }

  if (!data) {
    return (
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-col items-center justify-center py-12">
          {!hasRequiredData ? (
            <>
              <p className="text-muted-foreground mb-2 text-center">
                Sync Top Videos first
              </p>
              <p className="text-sm text-muted-foreground mb-4 text-center">
                Click 'Sync Top Videos' above to load data.
              </p>
              <Button onClick={handleGenerate} className="gap-2 cursor-pointer" disabled title="Sync Top Videos first">
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
    );
  }

  // Определяем какой формат данных использовать
  const isNewFormat = isNewFormatData(data);
  const isOldFormat = isOldFormatData(data);

  // Если это новый формат (v2.0) - показываем его
  if (isNewFormat) {
    return (
      <CardContent className="space-y-6 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Brain className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              Audience Insights (v2.0)
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Deep audience analysis powered by AI
            </p>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handleGenerate}
                size="icon"
                variant="outline"
              >
                <RefreshCcw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Refresh Analysis
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Fallback Warning */}
        {data.usingFallback && (
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
                    disabled={isEnrichingAudience}
                    size="sm"
                    variant="outline"
                    className="gap-2 border-amber-400 text-amber-900 hover:bg-amber-100 dark:text-amber-100 dark:hover:bg-amber-900/20 cursor-pointer"
                  >
                    {isEnrichingAudience ? (
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
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Audience Profile */}
        {data.audienceProfile && (
          <Card className="border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                Audience Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{data.audienceProfile}</p>
            </CardContent>
          </Card>
        )}

        {/* Motivations */}
        {data.motivations && data.motivations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Heart className="h-5 w-5 text-pink-600 dark:text-pink-400" />
                Motivations & Needs ({data.motivations.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {(data.motivations || []).map((motivation, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <span className="text-pink-600 dark:text-pink-400 mt-0.5 flex-shrink-0">♥</span>
                    <span>{motivation}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Segments */}
        {data.segments && data.segments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                Audience Segments ({data.segments.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {(data.segments || []).map((segment, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm border-l-2 border-green-200 dark:border-green-900 pl-3">
                    <span className="text-green-600 dark:text-green-400 flex-shrink-0">→</span>
                    <span>{segment}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Content Patterns */}
        {data.contentPatterns && data.contentPatterns.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                Content Patterns ({data.contentPatterns.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {(data.contentPatterns || []).map((pattern, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <span className="text-purple-600 dark:text-purple-400 mt-0.5">✓</span>
                    <span>{pattern}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Anti-patterns */}
        {data.antiPatterns && data.antiPatterns.length > 0 && (
          <Card className="border-red-200 dark:border-red-900 bg-red-50/30 dark:bg-red-950/10">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
                What Doesn't Work ({data.antiPatterns.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {(data.antiPatterns || []).map((pattern, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <span className="text-red-600 dark:text-red-400 mt-0.5">✗</span>
                    <span>{pattern}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Behavioral Analytics */}
        {data.behavioralAnalytics && data.behavioralAnalytics.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                Behavioral Analytics ({data.behavioralAnalytics.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {(data.behavioralAnalytics || []).map((behavior, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <span className="text-yellow-600 dark:text-yellow-400 mt-0.5">📊</span>
                    <span>{behavior}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Growth Opportunities */}
        {data.growthOpportunities && data.growthOpportunities.length > 0 && (
          <Card className="border-green-200 dark:border-green-900 bg-green-50/30 dark:bg-green-950/10">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-green-600 dark:text-green-400" />
                Growth Opportunities ({data.growthOpportunities.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {(data.growthOpportunities || []).map((opportunity, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <span className="text-green-600 dark:text-green-400 mt-0.5">🚀</span>
                    <span>{opportunity}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Actionable Recommendations */}
        {data.actionableRecommendations && data.actionableRecommendations.length > 0 && (
          <Card className="border-cyan-200 dark:border-cyan-900 bg-cyan-50/30 dark:bg-cyan-950/10">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                What to Do Now ({data.actionableRecommendations.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {(data.actionableRecommendations || []).map((recommendation, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm">
                    <span className="text-cyan-600 dark:text-cyan-400 flex-shrink-0 mt-0.5">→</span>
                    <span>{recommendation}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {data.generatedAt && (
          <p className="text-xs text-muted-foreground text-center">
            Analysis generated: {new Date(data.generatedAt).toLocaleString("en-US")}
          </p>
        )}
      </CardContent>
    );
  }

  // Если это старый формат - показываем его (для обратной совместимости)
  if (isOldFormat) {
    return (
      <CardContent className="space-y-4 pt-6">
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
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handleGenerate}
                size="icon"
                variant="outline"
              >
                <RefreshCcw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Refresh Analysis
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Stats Bar */}
        {data.stats && (
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="text-2xl font-bold">{data.stats.totalAnalyzed ?? 0}</div>
              <div className="text-xs text-muted-foreground">Analyzed</div>
            </div>
            <div className="bg-purple-500/10 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{data.stats.highEngagement ?? 0}</div>
              <div className="text-xs text-muted-foreground">High Engagement</div>
            </div>
            <div className="bg-blue-500/10 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{data.stats.rising ?? 0}</div>
              <div className="text-xs text-muted-foreground">Rising</div>
            </div>
            <div className="bg-red-500/10 rounded-lg p-4">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">{data.stats.weak ?? 0}</div>
              <div className="text-xs text-muted-foreground">Weak</div>
            </div>
          </div>
        )}

        {/* Fallback Warning */}
        {data.usingFallback && (
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
                    disabled={isEnrichingAudience}
                    size="sm"
                    variant="outline"
                    className="gap-2 border-amber-400 text-amber-900 hover:bg-amber-100 dark:text-amber-100 dark:hover:bg-amber-900/20 cursor-pointer"
                  >
                    {isEnrichingAudience ? (
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
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* AI Explanation */}
        {data.explanation && (
          <Card className="border-purple-200 dark:border-purple-900 bg-purple-50/50 dark:bg-purple-950/20">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                Why these topics get high engagement
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{data.explanation}</p>
            </CardContent>
          </Card>
        )}

        {/* Main Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* High Engagement Themes */}
          {data.highEngagementThemes && data.highEngagementThemes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Heart className="h-5 w-5 text-pink-600 dark:text-pink-400" />
                  High Engagement Themes
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
          )}

          {/* Engaging Formats */}
          {data.engagingFormats && data.engagingFormats.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  Engaging Formats
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
          )}

          {/* Audience Patterns */}
          {data.audiencePatterns && data.audiencePatterns.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  Audience Patterns
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
          )}
        </div>

        {/* Weak Points - Full Width */}
        {data.weakPoints && data.weakPoints.length > 0 && (
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
                {data.weakPoints.map((weak, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-red-600 dark:text-red-400 mt-1">⚠</span>
                    <span className="text-sm">{weak}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Recommendations - Full Width */}
        {data.recommendations && data.recommendations.length > 0 && (
          <Card className="border-yellow-200 dark:border-yellow-900 bg-yellow-50/30 dark:bg-yellow-950/10">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                How to increase engagement
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
        )}

        {/* High Engagement Videos */}
        {data.highEngagementVideos && data.highEngagementVideos.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">High Engagement Videos</CardTitle>
              <CardDescription>
                Videos with engagement 50%+ above median
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
                        <span>{formatNumber(video.viewCount)} views</span>
                        <span>{formatNumber(video.likeCount)} likes</span>
                        <span>{formatNumber(video.commentCount)} comments</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <div className="text-right">
                        <div className="text-sm font-bold text-purple-600 dark:text-purple-400">
                          {formatEngagement(video.engagementScore, data.usingFallback || false)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {data.usingFallback ? "score" : "engagement"}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {data.generatedAt && (
          <p className="text-xs text-muted-foreground text-center">
            Analysis generated: {new Date(data.generatedAt).toLocaleString("en-US")}
          </p>
        )}
      </CardContent>
    );
  }

  // Если данные есть но структура не соответствует ни старому ни новому формату
  return (
    <CardContent className="space-y-4 pt-6">
      <div className="flex flex-col items-center justify-center py-12">
        <AlertTriangle className="h-12 w-12 text-yellow-600 mb-4" />
        <h3 className="text-lg font-semibold mb-2">Data format error</h3>
        <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
          The analysis data has an unexpected format. Try generating a fresh analysis.
        </p>
        <Button onClick={handleGenerate} className="gap-2 cursor-pointer">
          <Users className="h-4 w-4" />
          Regenerate Analysis
        </Button>
        {error && (
          <p className="text-sm text-destructive mt-4">{error}</p>
        )}
      </div>
    </CardContent>
  );
}
