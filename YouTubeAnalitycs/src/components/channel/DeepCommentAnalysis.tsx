"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, Brain, Heart, AlertCircle, MessageSquare, Users, Lightbulb, TrendingUp, Quote } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { CombinedDeepAnalysis } from "@/lib/ai/comments-analysis";

interface DeepCommentAnalysisProps {
  channelId: number;
  initialData?: (CombinedDeepAnalysis & {
    cached?: boolean;
    createdAt?: number;
    analysisLanguage?: string;
    hasRussianVersion?: boolean;
  }) | null;
  hasRequiredData?: boolean;
  analysisLanguage?: "en" | "ru";
}

interface ProgressData {
  status: string;
  progress_current: number;
  progress_total: number;
  percent: number;
}

export function DeepCommentAnalysis({
  channelId,
  initialData,
  hasRequiredData = true,
  analysisLanguage = "en"
}: DeepCommentAnalysisProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [data, setData] = useState<(CombinedDeepAnalysis & {
    cached?: boolean;
    createdAt?: number;
    analysisLanguage?: string;
    hasRussianVersion?: boolean;
  }) | null>(initialData || null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Синхронизация локального state с initialData при обновлении
  useEffect(() => {
    if (initialData) {
      setData(initialData);
    }
  }, [initialData]);

  // Polling для получения прогресса
  useEffect(() => {
    if (!loading || !channelId) return;

    const fetchProgress = async () => {
      try {
        const res = await fetch(`/api/channel/${channelId}/comments/ai/progress`);
        if (res.ok) {
          const progressData = await res.json();
          setProgress(progressData);

          // Если анализ завершен, останавливаем polling
          if (progressData.status === 'done' || progressData.status === 'error') {
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }

            if (progressData.status === 'done') {
              // Даем время на сохранение результата
              setTimeout(() => {
                setLoading(false);
                router.refresh();
              }, 1000);
            } else if (progressData.status === 'error') {
              setError('Analysis failed. Please try again.');
              setLoading(false);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching progress:', err);
      }
    };

    // Начальный fetch
    fetchProgress();

    // Устанавливаем интервал polling каждые 1.5 секунды
    intervalRef.current = setInterval(fetchProgress, 1500);

    // Cleanup при unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [loading, channelId, router]);

  async function handleGenerate() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/channel/${channelId}/comments/ai`, {
        method: "POST",
        credentials: "include", // Важно: отправляем cookies с session
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to generate deep analysis");
      }

      const result = await res.json();
      setData(result);

      // Обновляем страницу чтобы показать новые данные
      router.refresh();
    } catch (err) {
      let errorMsg = "Unknown error";

      if (err instanceof TypeError && err.message === "Failed to fetch") {
        errorMsg = "Network error. Please check your connection and try again.";
      } else if (err instanceof Error) {
        errorMsg = err.message;
      }

      console.error('[DeepCommentAnalysis] Generation error:', err);
      toast.error(errorMsg);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  }

  async function handleTranslate() {
    // Защита от перевода без анализа
    if (!data || !data.themes || data.totalAnalyzed === 0) {
      toast.error('No English analysis found. Please run Deep Analysis first.');
      return;
    }

    setTranslating(true);
    setError(null);

    try {
      const res = await fetch(`/api/channel/${channelId}/comments/ai/translate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Важно: отправляем cookies с session
        body: JSON.stringify({ language: "ru" }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to translate analysis");
      }

      // Обновляем страницу чтобы показать переведённую версию
      router.refresh();
    } catch (err) {
      let errorMsg = "Unknown error";

      if (err instanceof TypeError && err.message === "Failed to fetch") {
        errorMsg = "Network error. Please check your connection and try again.";
      } else if (err instanceof Error) {
        errorMsg = err.message;
      }

      console.error('[DeepCommentAnalysis] Translation error:', err);
      toast.error(errorMsg);
      setError(errorMsg);
    } finally {
      setTranslating(false);
    }
  }

  if (loading) {
    const estimatedTimePerChunk = 3; // секунды на чанк
    const remaining = progress
      ? (progress.progress_total - progress.progress_current) * estimatedTimePerChunk
      : 0;
    const eta = remaining > 0 ? `~${Math.ceil(remaining)}s` : '';

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            Deep Audience Intelligence (AI v2.0)
          </CardTitle>
          <CardDescription>
            Deep audience comment analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 space-y-6">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-400" />

            {progress && progress.status === 'processing' && (
              <>
                <div className="text-center space-y-2">
                  <p className="text-sm font-medium">
                    🔄 Processing {progress.progress_current} / {progress.progress_total} chunks
                    {' '}({progress.percent}%)
                  </p>
                  {eta && (
                    <p className="text-xs text-muted-foreground">
                      ETA: {eta}
                    </p>
                  )}
                </div>

                <div className="w-full max-w-md">
                  <Progress value={progress.percent} className="h-2" />
                </div>
              </>
            )}

            {(!progress || progress.status === 'pending') && (
              <div className="text-center space-y-2">
                <p className="text-muted-foreground">Initializing analysis...</p>
                <p className="text-sm text-muted-foreground">This may take 30-60 seconds</p>
              </div>
            )}
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
            <Brain className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            Deep Audience Intelligence (AI v2.0)
          </CardTitle>
          <CardDescription>
            Deep AI comment analysis: themes, pain points, segments, hidden patterns
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12">
            {!hasRequiredData ? (
              <>
                <p className="text-muted-foreground mb-2 text-center">
                  To generate Deep Analysis, sync videos and comments first.
                </p>
                <p className="text-sm text-muted-foreground mb-4 text-center">
                  Click 'Sync Top Videos' and 'Sync Comments' buttons above to load data.
                </p>
                <Button onClick={handleGenerate} className="gap-2" disabled title="Sync videos and comments first">
                  <Brain className="h-4 w-4" />
                  Generate Deep Analysis
                </Button>
              </>
            ) : (
              <>
                <p className="text-muted-foreground mb-4 text-center">
                  Deep analysis will reveal hidden patterns, audience segments, and actionable insights from comments.
                </p>
                <Button onClick={handleGenerate} className="gap-2">
                  <Brain className="h-4 w-4" />
                  Generate Deep Analysis
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

  // Парсим analysis_en и analysis_ru для выбора нужной версии
  let displayData = data;

  if (data) {
    try {
      // Парсим английскую версию
      const enData = data.analysis_en ? JSON.parse(data.analysis_en) : data;

      // Парсим русскую версию если есть
      const ruData = data.analysis_ru ? JSON.parse(data.analysis_ru) : null;

      // Выбираем какую версию показывать
      displayData = (analysisLanguage === "ru" && ruData) ? ruData : enData;
    } catch (err) {
      console.error('[DeepCommentAnalysis] Failed to parse analysis data:', err);
      // Используем data как fallback
      displayData = data;
    }
  }

  // Безопасный fallback для sentiment
  const sentiment = displayData.sentimentSummary ?? {
    positive: 0,
    negative: 0,
    neutral: 0,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            Deep Audience Intelligence (AI v2.0)
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Deep AI analysis of {displayData.totalAnalyzed} comments
          </p>
        </div>
        <div className="flex gap-2">
          {data && data.themes && data.totalAnalyzed > 0 && !data.hasRussianVersion && (
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
          <Button onClick={handleGenerate} variant="outline" size="sm" className="gap-2">
            <Brain className="h-4 w-4" />
            Refresh Analysis
          </Button>
        </div>
      </div>

      {/* Show translation prompt when Russian is selected but not available */}
      {analysisLanguage === "ru" && data && data.themes && data.totalAnalyzed > 0 && !data.hasRussianVersion ? (
        <Card className="border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center py-6 text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-blue-600 dark:text-blue-400" />
              <div className="space-y-2">
                <p className="font-semibold">Russian version not yet generated</p>
                <p className="text-sm text-muted-foreground max-w-md">
                  The analysis is currently available in English only. Click the button below to generate a Russian translation.
                </p>
              </div>
              <Button
                onClick={handleTranslate}
                disabled={translating}
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
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Sentiment Summary */}
      <Card className="border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/20">
        <CardHeader>
          <CardTitle className="text-lg">Audience Emotional Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                {sentiment.positive}%
              </div>
              <div className="text-xs text-muted-foreground mt-1">Positive</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-600 dark:text-gray-400">
                {sentiment.neutral}%
              </div>
              <div className="text-xs text-muted-foreground mt-1">Neutral</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                {sentiment.negative}%
              </div>
              <div className="text-xs text-muted-foreground mt-1">Negative</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Themes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Top Themes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {displayData.themes.length > 0 ? (
              <ul className="space-y-2">
                {displayData.themes.map((theme, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-blue-600 dark:text-blue-400 mt-1">▪</span>
                    <span className="text-sm">{theme}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Insufficient data</p>
            )}
          </CardContent>
        </Card>

        {/* Pain Points */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              Audience Pain Points
            </CardTitle>
          </CardHeader>
          <CardContent>
            {displayData.painPoints.length > 0 ? (
              <ul className="space-y-2">
                {displayData.painPoints.map((pain, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-orange-600 dark:text-orange-400 mt-1">⚠</span>
                    <span className="text-sm">{pain}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Insufficient data</p>
            )}
          </CardContent>
        </Card>

        {/* Requests */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              Audience Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            {displayData.requests.length > 0 ? (
              <ul className="space-y-2">
                {displayData.requests.map((request, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-purple-600 dark:text-purple-400 mt-1">💬</span>
                    <span className="text-sm">{request}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Insufficient data</p>
            )}
          </CardContent>
        </Card>

        {/* Praises */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Heart className="h-5 w-5 text-pink-600 dark:text-pink-400" />
              What They Like
            </CardTitle>
          </CardHeader>
          <CardContent>
            {displayData.praises.length > 0 ? (
              <ul className="space-y-2">
                {displayData.praises.map((praise, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-pink-600 dark:text-pink-400 mt-1">♥</span>
                    <span className="text-sm">{praise}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Insufficient data</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Audience Segments - Full Width */}
      <Card className="border-cyan-200 dark:border-cyan-900 bg-cyan-50/30 dark:bg-cyan-950/10">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
            Audience Segments
          </CardTitle>
          <CardDescription>
            Different user groups in your audience
          </CardDescription>
        </CardHeader>
        <CardContent>
          {displayData.audienceSegments.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {displayData.audienceSegments.map((segment, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-900 dark:text-cyan-100 rounded-full text-sm"
                >
                  {segment}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Insufficient data</p>
          )}
        </CardContent>
      </Card>

      {/* Hidden Patterns - Full Width */}
      <Card className="border-violet-200 dark:border-violet-900 bg-violet-50/30 dark:bg-violet-950/10">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Brain className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            Hidden Patterns
          </CardTitle>
          <CardDescription>
            Non-obvious insights discovered by AI
          </CardDescription>
        </CardHeader>
        <CardContent>
          {displayData.hiddenPatterns.length > 0 ? (
            <ul className="space-y-2">
              {displayData.hiddenPatterns.map((pattern, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-violet-600 dark:text-violet-400 mt-1">→</span>
                  <span className="text-sm">{pattern}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Insufficient data</p>
          )}
        </CardContent>
      </Card>

      {/* Actionable Ideas - Full Width */}
      <Card className="border-emerald-200 dark:border-emerald-900 bg-emerald-50/30 dark:bg-emerald-950/10">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Actionable Recommendations
          </CardTitle>
          <CardDescription>
            Specific steps to improve content and engagement
          </CardDescription>
        </CardHeader>
        <CardContent>
          {displayData.actionableIdeas.length > 0 ? (
            <ul className="space-y-3">
              {displayData.actionableIdeas.map((idea, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-emerald-600 dark:text-emerald-400 mt-1">💡</span>
                  <span className="text-sm font-medium">{idea}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Insufficient data</p>
          )}
        </CardContent>
      </Card>

      {/* Top Quotes */}
      {displayData.topQuotes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Quote className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              Top Quotes from Comments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {displayData.topQuotes.slice(0, 8).map((quote, idx) => (
                <blockquote
                  key={idx}
                  className="pl-4 border-l-2 border-gray-300 dark:border-gray-700 text-sm italic text-muted-foreground"
                >
                  "{quote}"
                </blockquote>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {data.createdAt && (
        <p className="text-xs text-muted-foreground text-center">
          Analysis generated: {new Date(data.createdAt).toLocaleString("en-US")}
          {data.cached && " (cached)"}
        </p>
      )}
        </>
      )}
    </div>
  );
}
