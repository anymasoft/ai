"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, MessageSquare, Sparkles, Heart, AlertCircle, ThumbsUp, Lightbulb } from "lucide-react";
import { useRouter } from "next/navigation";

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
  channelId: number;
  initialData?: CommentInsightsData | null;
}

export function CommentInsights({ channelId, initialData }: CommentInsightsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<CommentInsightsData | null>(initialData || null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/channel/${channelId}/comments/insights`, {
        method: "POST",
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to generate comment insights");
      }

      const result = await res.json();
      setData(result);

      // Обновляем страницу чтобы показать новые данные
      router.refresh();
    } catch (err) {
      console.error("Error generating comment insights:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            Comment Intelligence
          </CardTitle>
          <CardDescription>
            Анализ комментариев аудитории
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Анализ комментариев...</p>
            <p className="text-sm text-muted-foreground mt-2">Это может занять 15-25 секунд</p>
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
            <MessageSquare className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            Comment Intelligence
          </CardTitle>
          <CardDescription>
            Анализ комментариев аудитории
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">
              Comment Intelligence покажет интересы, боли и запросы аудитории на основе комментариев.
            </p>
            <Button onClick={handleGenerate} className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Сгенерировать анализ комментариев
            </Button>
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
            <MessageSquare className="h-6 w-6 text-teal-600 dark:text-teal-400" />
            Comment Intelligence
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Интересы, боли и запросы аудитории из комментариев
          </p>
        </div>
        <Button onClick={handleGenerate} variant="outline" size="sm" className="gap-2">
          <MessageSquare className="h-4 w-4" />
          Обновить анализ
        </Button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="text-2xl font-bold">{data.stats.totalComments}</div>
          <div className="text-xs text-muted-foreground">Всего комментариев</div>
        </div>
        <div className="bg-teal-500/10 rounded-lg p-4">
          <div className="text-2xl font-bold text-teal-600 dark:text-teal-400">{data.stats.analyzedComments}</div>
          <div className="text-xs text-muted-foreground">Проанализировано</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="text-2xl font-bold">{data.stats.totalVideos}</div>
          <div className="text-xs text-muted-foreground">Видео</div>
        </div>
      </div>

      {/* AI Explanation */}
      <Card className="border-teal-200 dark:border-teal-900 bg-teal-50/50 dark:bg-teal-950/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            Общий настрой аудитории
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
              Интересы аудитории
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
              Боли аудитории
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
              Запросы на темы
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
            Жалобы и недовольства
          </CardTitle>
          <CardDescription>
            Что не нравится аудитории
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
            Похвалы и что нравится
          </CardTitle>
          <CardDescription>
            Что хвалят и что работает
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
            Идеи для следующих видео
          </CardTitle>
          <CardDescription>
            На основе запросов аудитории из комментариев
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
          Анализ сгенерирован: {new Date(data.generatedAt).toLocaleString("ru-RU")}
        </p>
      )}
    </div>
  );
}
