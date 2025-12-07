"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Loader2,
  Brain,
  Heart,
  AlertCircle,
  MessageSquare,
  Users,
  Lightbulb,
  TrendingUp,
  Quote,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { CombinedDeepAnalysis } from "@/lib/ai/comments-analysis";

interface DeepCommentAnalysisProps {
  channelId: number;
  initialData?: (CombinedDeepAnalysis & {
    cached?: boolean;
    createdAt?: number;
  }) | null;
  hasRequiredData?: boolean;
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
}: DeepCommentAnalysisProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(initialData || null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const intervalRef = useRef<number | NodeJS.Timeout | null>(null);

  // Обновляем локальные данные при изменении initialData
  useEffect(() => {
    if (initialData) {
      setData(initialData);
    }
  }, [initialData]);

  // Очистка интервала при размонтировании
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current as any);
      }
    };
  }, []);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setProgress(null);

    try {
      // Запускаем анализ
      const res = await fetch(`/api/channel/${channelId}/comments/ai`, {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || "Failed to generate analysis");
      }

      // Начинаем поллинг прогресса
      startPolling();
    } catch (err) {
      toast.error("Generation failed");
      setError("Generation failed");
      setLoading(false);
    }
  }

  function startPolling() {
    if (!channelId) return;

    const fetchProgress = async () => {
      try {
        const res = await fetch(`/api/channel/${channelId}/comments/ai/progress`, {
          credentials: "include",
        });
        if (!res.ok) {
          console.warn("[DeepCommentAnalysis] Progress fetch not ok:", res.status);
          return;
        }
        const progressData = await res.json();
        console.log("[DeepCommentAnalysis] Progress data:", progressData);
        setProgress(progressData);

        if (progressData.status === "done" || progressData.status === "error") {
          if (intervalRef.current) {
            clearInterval(intervalRef.current as any);
            intervalRef.current = null;
          }
          setLoading(false);
          if (progressData.status === "done") {
            router.refresh();
          }
        }
      } catch (err) {
        console.error("[DeepCommentAnalysis] Error fetching progress:", err);
      }
    };

    // начальный запрос
    fetchProgress();
    // интервальный polling
    if (intervalRef.current) clearInterval(intervalRef.current as any);
    intervalRef.current = setInterval(fetchProgress, 1500);
  }

  if (loading) {
    const estimatedTimePerChunk = 3; // секунды на чанк
    const remaining = progress
      ? (progress.progress_total - progress.progress_current) * estimatedTimePerChunk
      : 0;
    const eta = remaining > 0 ? `~${Math.ceil(remaining)}s` : "";

    return (
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-col items-center justify-center py-12 space-y-6">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-400" />

          {progress && progress.status === "processing" && (
            <>
              <div className="text-center space-y-2">
                <p className="text-sm font-medium">
                  🔄 Processing {progress.progress_current} / {progress.progress_total} chunks ({progress.percent}%)
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

          {(!progress || progress.status === "pending") && (
            <div className="text-center space-y-2">
              <p className="text-muted-foreground">Initializing analysis...</p>
              <p className="text-sm text-muted-foreground">This may take 30–60 seconds</p>
            </div>
          )}
        </div>
      </CardContent>
    );
  }

  if (!data) {
    return (
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-col items-center justify-center py-6">
          {!hasRequiredData ? (
            <>
              <p className="text-muted-foreground mb-2 text-center">
                Sync Comments first
              </p>
              <p className="text-sm text-muted-foreground mb-4 text-center">
                Click 'Sync Comments' button above to load data.
              </p>
              <Button onClick={handleGenerate} disabled title="Sync Comments first">
                Generate Deep Analysis
              </Button>
            </>
          ) : (
            <>
              <p className="text-muted-foreground mb-4">
                Deep AI analysis of audience comments.
              </p>
              <Button onClick={handleGenerate}>
                Generate Deep Analysis
              </Button>
            </>
          )}
          {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
        </div>
      </CardContent>
    );
  }

  const sentiment = data.sentimentSummary ?? {
    positive: 0,
    neutral: 0,
    negative: 0,
  };

  return (
    <CardContent className="space-y-4 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-indigo-600" />
            Deep Audience Intelligence (AI v2.0)
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Deep AI analysis of {data.totalAnalyzed} comments
          </p>
        </div>

        <Button onClick={handleGenerate} variant="outline" size="sm" className="gap-2">
          <Brain className="h-4 w-4" />
          Refresh Analysis
        </Button>
      </div>

      {/* SENTIMENT */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Audience Emotional Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{sentiment.positive}%</div>
              <div className="text-xs mt-1">Positive</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-600">{sentiment.neutral}%</div>
              <div className="text-xs mt-1">Neutral</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600">{sentiment.negative}%</div>
              <div className="text-xs mt-1">Negative</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* THEMES */}
      {data.themes?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Top Themes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.themes.map((t: string, i: number) => (
                <li key={i} className="flex items-start gap-2">
                  ▪ <span>{t}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Pain Points */}
      {data.painPoints?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              Audience Pain Points
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.painPoints.map((p: string, i: number) => (
                <li key={i} className="flex items-start gap-2">
                  ⚠ <span>{p}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* REQUESTS */}
      {data.requests?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-purple-600" />
              Audience Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.requests.map((r: string, i: number) => (
                <li key={i}>💬 {r}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* PRAISES */}
      {data.praises?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Heart className="h-5 w-5 text-pink-600" />
              What They Like
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.praises.map((p: string, i: number) => (
                <li key={i}>♥ {p}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* SEGMENTS */}
      {data.audienceSegments?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Audience Segments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data.audienceSegments.map((s: string, i: number) => (
                <span key={i} className="px-3 py-1 bg-cyan-100 rounded-full text-sm">
                  {s}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* HIDDEN PATTERNS */}
      {data.hiddenPatterns?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Hidden Patterns</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.hiddenPatterns.map((p: string, i: number) => (
                <li key={i}>→ {p}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* ACTIONABLE IDEAS */}
      {data.actionableIdeas?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Actionable Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {data.actionableIdeas.map((a: string, i: number) => (
                <li key={i}>💡 {a}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* TOP QUOTES */}
      {data.topQuotes?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Quotes from Comments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.topQuotes.slice(0, 8).map((quote: string, i: number) => (
                <blockquote key={i} className="pl-4 border-l-2 text-sm italic">
                  "{quote}"
                </blockquote>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </CardContent>
  );
}
