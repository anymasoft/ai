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

  const sentiment = data.sentiment ?? data.sentimentSummary ?? {
    positive: 0,
    neutral: 0,
    negative: 0,
  };

  // Вычисляем проценты на основе totalAnalyzed
  const total = sentiment.positive + sentiment.neutral + sentiment.negative;

  // Рассчитываем проценты так, чтобы их сумма была ровно 100%
  let positivePercent: number;
  let neutralPercent: number;
  let negativePercent: number;

  if (total === 0) {
    positivePercent = 0;
    neutralPercent = 0;
    negativePercent = 0;
  } else {
    positivePercent = Math.round((sentiment.positive / total) * 100);
    negativePercent = Math.round((sentiment.negative / total) * 100);
    neutralPercent = 100 - positivePercent - negativePercent;

    // Защита от крайних случаев
    if (neutralPercent < 0) {
      neutralPercent = 0;
    }
  }

  return (
    <CardContent className="space-y-4 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-indigo-600" />
            Deep Audience Intelligence (AI v2.1)
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
              <div className="text-3xl font-bold text-green-600">{positivePercent}%</div>
              <div className="text-xs mt-1">Positive ({sentiment.positive})</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-600">{neutralPercent}%</div>
              <div className="text-xs mt-1">Neutral ({sentiment.neutral})</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600">{negativePercent}%</div>
              <div className="text-xs mt-1">Negative ({sentiment.negative})</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* EMOTIONAL OVERVIEW (v2.1) */}
      {data.emotionalOverview && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Heart className="h-5 w-5 text-pink-600" />
              Emotional Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{data.emotionalOverview}</p>
          </CardContent>
        </Card>
      )}

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

      {/* KEY TOPICS (v2.1) */}
      {data.keyTopics?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Key Topics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.keyTopics.map((topic: any, i: number) => (
                <div key={i} className="p-3 border rounded-lg">
                  <h4 className="font-semibold text-sm">{topic.name}</h4>
                  <p className="text-sm text-muted-foreground mt-1">{topic.description}</p>
                  {topic.examples?.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-2">Examples: {topic.examples.slice(0, 3).join(", ")}</p>
                  )}
                  {topic.motive && (
                    <p className="text-xs text-muted-foreground mt-1">Motive: {topic.motive}</p>
                  )}
                </div>
              ))}
            </div>
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

      {/* POSITIVE TRIGGERS (v2.1) */}
      {data.positiveTriggers?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Heart className="h-5 w-5 text-green-600" />
              Positive Triggers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.positiveTriggers.map((trigger: any, i: number) => (
                <div key={i} className="p-3 bg-green-50 rounded-lg">
                  <h4 className="font-semibold text-sm text-green-900">{trigger.trigger}</h4>
                  <p className="text-sm text-green-800 mt-1">Praised: {trigger.what_praised}</p>
                  <p className="text-xs text-green-700 mt-1">{trigger.why_resonates}</p>
                  {trigger.video_types && (
                    <p className="text-xs text-muted-foreground mt-1">Video types: {trigger.video_types}</p>
                  )}
                </div>
              ))}
            </div>
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

      {/* NEGATIVE TRIGGERS (v2.1) */}
      {data.negativeTriggers?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              Negative Triggers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.negativeTriggers.map((trigger: any, i: number) => (
                <div key={i} className="p-3 bg-red-50 rounded-lg">
                  <h4 className="font-semibold text-sm text-red-900">{trigger.trigger}</h4>
                  <p className="text-sm text-red-800 mt-1">Cause: {trigger.what_causes_negativity}</p>
                  <p className="text-xs text-red-700 mt-1">{trigger.why_harmful}</p>
                  {trigger.fix && (
                    <p className="text-xs text-blue-700 mt-1">Fix: {trigger.fix}</p>
                  )}
                </div>
              ))}
            </div>
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

      {/* FAQ (v2.1) */}
      {data.faq?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-indigo-600" />
              Frequently Asked Questions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.faq.map((item: any, i: number) => (
                <div key={i} className="p-3 border-l-4 border-indigo-300">
                  <h4 className="font-semibold text-sm text-indigo-900">{item.question}</h4>
                  {item.why_appears && (
                    <p className="text-xs text-muted-foreground mt-1">Why: {item.why_appears}</p>
                  )}
                  {item.action && (
                    <p className="text-xs text-blue-700 mt-1">Action: {item.action}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* SEGMENTS (v2.1) */}
      {data.audienceSegments?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-cyan-600" />
              Audience Segments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.audienceSegments.map((segment: any, i: number) => (
                <div key={i} className="p-4 border rounded-lg bg-cyan-50">
                  <h4 className="font-semibold text-cyan-900">{segment.segment}</h4>
                  <p className="text-sm text-muted-foreground mt-2">{segment.description}</p>

                  <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                    {segment.writes_about && (
                      <div>
                        <span className="font-semibold text-cyan-800">Writes about:</span>
                        <p className="text-muted-foreground">{segment.writes_about}</p>
                      </div>
                    )}
                    {segment.understanding_level && (
                      <div>
                        <span className="font-semibold text-cyan-800">Understanding:</span>
                        <p className="text-muted-foreground">{segment.understanding_level}</p>
                      </div>
                    )}
                    {segment.motives && (
                      <div>
                        <span className="font-semibold text-cyan-800">Motives:</span>
                        <p className="text-muted-foreground">{segment.motives}</p>
                      </div>
                    )}
                    {segment.suitable_content && (
                      <div>
                        <span className="font-semibold text-cyan-800">Suitable content:</span>
                        <p className="text-muted-foreground">{segment.suitable_content}</p>
                      </div>
                    )}
                  </div>

                  {segment.growth_strategy && (
                    <div className="mt-3 p-2 bg-blue-100 rounded">
                      <p className="text-xs font-semibold text-blue-900">Growth strategy:</p>
                      <p className="text-xs text-blue-800">{segment.growth_strategy}</p>
                    </div>
                  )}
                </div>
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

      {/* BEHAVIORAL INSIGHTS (v2.1) */}
      {data.behavioralInsights?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-600" />
              Behavioral Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.behavioralInsights.map((insight: string, i: number) => (
                <li key={i} className="flex items-start gap-2">
                  🧠 <span className="text-sm">{insight}</span>
                </li>
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

      {/* MISSING ELEMENTS (v2.1) */}
      {data.missingElements?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              Missing Elements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.missingElements.map((element: string, i: number) => (
                <li key={i} className="flex items-start gap-2">
                  ✋ <span className="text-sm">{element}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* GROWTH OPPORTUNITIES (v2.1) */}
      {data.growthOpportunities?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
              Growth Opportunities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.growthOpportunities.map((opp: any, i: number) => (
                <div key={i} className="p-3 border-l-4 border-emerald-400 bg-emerald-50">
                  <h4 className="font-semibold text-sm text-emerald-900">{opp.opportunity}</h4>
                  {opp.based_on && (
                    <p className="text-xs text-muted-foreground mt-1">Based on: {opp.based_on}</p>
                  )}
                  {opp.how_use && (
                    <p className="text-xs text-emerald-800 mt-1">How to use: {opp.how_use}</p>
                  )}
                  {opp.expected_effect && (
                    <p className="text-xs text-emerald-700 mt-1">Expected effect: {opp.expected_effect}</p>
                  )}
                </div>
              ))}
            </div>
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

      {/* CHECKLIST (v2.1) - 8 Fixed Items */}
      {data.checklist?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-600" />
              Action Checklist
            </CardTitle>
            <CardDescription>8 key actions to improve content based on audience feedback</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {data.checklist.slice(0, 8).map((item: string, i: number) => (
                <div key={i} className="flex items-start gap-3 p-2 border rounded">
                  <span className="text-lg font-bold text-indigo-600 min-w-6">{i + 1}.</span>
                  <span className="text-sm leading-relaxed">{item || `Action ${i + 1}`}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </CardContent>
  );
}
