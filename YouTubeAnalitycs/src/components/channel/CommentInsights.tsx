"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MessageSquare, Sparkles, Heart, AlertCircle, ThumbsUp, Lightbulb, RefreshCcw, Loader2 } from "lucide-react";
import { AnalysisLoadingState } from "@/components/ui/AnalysisLoadingState";
import { useRouter } from "next/navigation";
import { useGenerationStatusStore } from "@/store/generationStatusStore";

interface CommentInsightsData {
  stats: {
    totalComments: number;
    analyzedComments: number;
    totalVideos: number;
  };
  audienceInterests: string[];
  audiencePainPoints: string[];
  requestedTopics: string[];
  complaints: string[];
  praises: string[];
  nextVideoIdeasFromAudience: string[];
  explanation: string;
  generatedAt?: number;
}

interface CommentInsightsProps {
  competitorId: number;
  channelId: string;
  initialData?: CommentInsightsData | null;
  hasRequiredData?: boolean;
}

export function CommentInsights({
  competitorId,
  channelId,
  initialData,
  hasRequiredData = true
}: CommentInsightsProps) {
  const router = useRouter();
  const { getStatus, setStatus } = useGenerationStatusStore();
  const generationKey = `${competitorId}:comment-analysis`;
  const loading = getStatus(generationKey) === "loading";
  const [data, setData] = useState<CommentInsightsData | null>(initialData || null);
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

  // Синхронизируем локальное состояние с initialData из SSR
  // Это нужно для обновления после router.refresh()
  useEffect(() => {
    if (initialData) {
      console.log("[CommentInsights] Синхронизация initialData с state:", {
        hasAudienceInterests: !!initialData.audienceInterests?.length,
        totalInterests: initialData.audienceInterests?.length || 0,
      });
      setData(initialData);
    }
  }, [initialData?.generatedAt]); // Зависимость только от generatedAt чтобы избежать лишних обновлений

  async function handleGenerate() {
    setStatus(generationKey, "loading");
    setError(null);

    try {
      const res = await fetch(`/api/channel/${competitorId}/comments/insights`, {
        method: "POST",
      });

      if (!res.ok) {
        const errorData = await res.json();
        setStatus(generationKey, "error");
        throw new Error(errorData.error || "Failed to generate comment insights");
      }

      const result = await res.json();
      console.log("[CommentInsights] Получен результат от API:", {
        hasStats: !!result.stats,
        audienceInterestsCount: result.audienceInterests?.length || 0,
        complaintsCount: result.complaints?.length || 0,
      });

      // Сразу устанавливаем данные в состояние чтобы отобразить результат
      // API гарантирует что данные сохранены в БД перед возвратом ответа
      setData(result);
      setCooldownUntil(Date.now() + COOLDOWN_MS);
      setStatus(generationKey, "success");

      // Сразу же обновляем страницу чтобы синхронизировать SSR данные
      // useEffect синхронизирует initialData с локальным состоянием
      router.refresh();
    } catch (err) {
      console.error("Error generating comment insights:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setStatus(generationKey, "error");
    }
  }

  if (loading) {
    return (
      <AnalysisLoadingState
        title="Анализирование комментариев..."
        subtitle="Это может занять 15-25 секунд"
      />
    );
  }

  if (!data) {
    return (
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground mb-4">
            Comment Intelligence will show interests, pain points, and requests from audience comments.
          </p>
          <Button variant="default" onClick={handleGenerate} className="gap-2 cursor-pointer" disabled={loading}>
            <MessageSquare className="h-4 w-4" />
            {loading ? "Анализируется..." : "Анализировать комментарии"}
          </Button>
          {error && (
            <p className="text-sm text-destructive mt-4">{error}</p>
          )}
        </div>
      </CardContent>
    );
  }

  return (
    <CardContent className="space-y-4 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-teal-600 dark:text-teal-400" />
            Comment Intelligence
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Interests, pain points and requests from audience comments
          </p>
        </div>
        <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={handleGenerate}
            size="icon"
            variant="outline"
            disabled={loading || isCooldownActive}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {isCooldownActive && getCooldownTimeRemaining()
            ? `Available in ${getCooldownTimeRemaining()!.hours}h ${getCooldownTimeRemaining()!.minutes}m`
            : "Обновить анализ"}
        </TooltipContent>
      </Tooltip>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="text-2xl font-bold">{data.stats.totalComments}</div>
          <div className="text-xs text-muted-foreground">Total comments</div>
        </div>
        <div className="bg-teal-500/10 rounded-lg p-4">
          <div className="text-2xl font-bold text-teal-600 dark:text-teal-400">{data.stats.analyzedComments}</div>
          <div className="text-xs text-muted-foreground">Analyzed</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="text-2xl font-bold">{data.stats.totalVideos}</div>
          <div className="text-xs text-muted-foreground">Videos</div>
        </div>
      </div>

      {/* AI Explanation */}
      <Card className="border-teal-200 dark:border-teal-900 bg-teal-50/50 dark:bg-teal-950/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            Overall Audience Mood
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{data.explanation}</p>
        </CardContent>
      </Card>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Audience Interests */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Heart className="h-5 w-5 text-pink-600 dark:text-pink-400" />
              Audience Interests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.audienceInterests.map((interest, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-pink-600 dark:text-pink-400 mt-1">♥</span>
                  <span className="text-sm">{interest}</span>
                </li>
              ))}
            </ul>
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
            <ul className="space-y-2">
              {data.audiencePainPoints.map((pain, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-orange-600 dark:text-orange-400 mt-1">⚠</span>
                  <span className="text-sm">{pain}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Requested Topics */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Topic Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.requestedTopics.map((topic, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-400 mt-1">💬</span>
                  <span className="text-sm">{topic}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Complaints - Full Width */}
      <Card className="border-red-200 dark:border-red-900 bg-red-50/30 dark:bg-red-950/10">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            Complaints & Frustrations
          </CardTitle>
          <CardDescription>
            What audience doesn't like
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {data.complaints.map((complaint, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-red-600 dark:text-red-400 mt-1">⚠</span>
                <span className="text-sm">{complaint}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Praises - Full Width */}
      <Card className="border-green-200 dark:border-green-900 bg-green-50/30 dark:bg-green-950/10">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ThumbsUp className="h-5 w-5 text-green-600 dark:text-green-400" />
            Praises & What Works
          </CardTitle>
          <CardDescription>
            What they praise and what works
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {data.praises.map((praise, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-green-600 dark:text-green-400 mt-1">👍</span>
                <span className="text-sm">{praise}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Next Video Ideas - Full Width */}
      <Card className="border-yellow-200 dark:border-yellow-900 bg-yellow-50/30 dark:bg-yellow-950/10">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            Next Video Ideas
          </CardTitle>
          <CardDescription>
            Based on audience requests from comments
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {data.nextVideoIdeasFromAudience.map((idea, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-yellow-600 dark:text-yellow-400 mt-1">💡</span>
                <span className="text-sm">{idea}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {data.generatedAt && (
        <p className="text-xs text-muted-foreground text-center">
          Analysis generated: {new Date(data.generatedAt).toLocaleString("en-US")}
        </p>
      )}
    </CardContent>
  );
}
