"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Brain, Heart, AlertCircle, MessageSquare, Users, Lightbulb, TrendingUp, Quote } from "lucide-react";
import { useRouter } from "next/navigation";
import type { CombinedDeepAnalysis } from "@/lib/ai/comments-analysis";

interface DeepCommentAnalysisProps {
  channelId: number;
  initialData?: (CombinedDeepAnalysis & { cached?: boolean; createdAt?: number }) | null;
}

export function DeepCommentAnalysis({ channelId, initialData }: DeepCommentAnalysisProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<(CombinedDeepAnalysis & { cached?: boolean; createdAt?: number }) | null>(
    initialData || null
  );
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/channel/${channelId}/comments/ai`, {
        method: "POST",
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
      console.error("Error generating deep analysis:", err);
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
            <Brain className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            Deep Audience Intelligence (AI v2.0)
          </CardTitle>
          <CardDescription>
            Глубокий анализ комментариев аудитории
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Генерация глубокого анализа...</p>
            <p className="text-sm text-muted-foreground mt-2">Это может занять 30-60 секунд</p>
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
            Глубокий AI-анализ комментариев: темы, боли, сегменты, скрытые паттерны
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4 text-center">
              Глубокий анализ выявит скрытые паттерны, сегменты аудитории и действенные инсайты из комментариев.
            </p>
            <Button onClick={handleGenerate} className="gap-2">
              <Brain className="h-4 w-4" />
              Сгенерировать Deep Analysis
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
            <Brain className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            Deep Audience Intelligence (AI v2.0)
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Глубокий AI-анализ {data.totalAnalyzed} комментариев
          </p>
        </div>
        <Button onClick={handleGenerate} variant="outline" size="sm" className="gap-2">
          <Brain className="h-4 w-4" />
          Обновить анализ
        </Button>
      </div>

      {/* Sentiment Summary */}
      <Card className="border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/20">
        <CardHeader>
          <CardTitle className="text-lg">Эмоциональный профиль аудитории</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                {data.sentimentSummary.positive}%
              </div>
              <div className="text-xs text-muted-foreground mt-1">Позитивные</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-600 dark:text-gray-400">
                {data.sentimentSummary.neutral}%
              </div>
              <div className="text-xs text-muted-foreground mt-1">Нейтральные</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                {data.sentimentSummary.negative}%
              </div>
              <div className="text-xs text-muted-foreground mt-1">Негативные</div>
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
              Топ темы
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.themes.length > 0 ? (
              <ul className="space-y-2">
                {data.themes.map((theme, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-blue-600 dark:text-blue-400 mt-1">▪</span>
                    <span className="text-sm">{theme}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Недостаточно данных</p>
            )}
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
            {data.painPoints.length > 0 ? (
              <ul className="space-y-2">
                {data.painPoints.map((pain, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-orange-600 dark:text-orange-400 mt-1">⚠</span>
                    <span className="text-sm">{pain}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Недостаточно данных</p>
            )}
          </CardContent>
        </Card>

        {/* Requests */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              Запросы аудитории
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.requests.length > 0 ? (
              <ul className="space-y-2">
                {data.requests.map((request, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-purple-600 dark:text-purple-400 mt-1">💬</span>
                    <span className="text-sm">{request}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Недостаточно данных</p>
            )}
          </CardContent>
        </Card>

        {/* Praises */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Heart className="h-5 w-5 text-pink-600 dark:text-pink-400" />
              Что нравится
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.praises.length > 0 ? (
              <ul className="space-y-2">
                {data.praises.map((praise, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-pink-600 dark:text-pink-400 mt-1">♥</span>
                    <span className="text-sm">{praise}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Недостаточно данных</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Audience Segments - Full Width */}
      <Card className="border-cyan-200 dark:border-cyan-900 bg-cyan-50/30 dark:bg-cyan-950/10">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
            Сегменты аудитории
          </CardTitle>
          <CardDescription>
            Различные группы пользователей в вашей аудитории
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.audienceSegments.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {data.audienceSegments.map((segment, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-900 dark:text-cyan-100 rounded-full text-sm"
                >
                  {segment}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Недостаточно данных</p>
          )}
        </CardContent>
      </Card>

      {/* Hidden Patterns - Full Width */}
      <Card className="border-violet-200 dark:border-violet-900 bg-violet-50/30 dark:bg-violet-950/10">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Brain className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            Скрытые паттерны
          </CardTitle>
          <CardDescription>
            Неочевидные инсайты, выявленные AI
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.hiddenPatterns.length > 0 ? (
            <ul className="space-y-2">
              {data.hiddenPatterns.map((pattern, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-violet-600 dark:text-violet-400 mt-1">→</span>
                  <span className="text-sm">{pattern}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Недостаточно данных</p>
          )}
        </CardContent>
      </Card>

      {/* Actionable Ideas - Full Width */}
      <Card className="border-emerald-200 dark:border-emerald-900 bg-emerald-50/30 dark:bg-emerald-950/10">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Действенные рекомендации
          </CardTitle>
          <CardDescription>
            Конкретные шаги для улучшения контента и взаимодействия
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.actionableIdeas.length > 0 ? (
            <ul className="space-y-3">
              {data.actionableIdeas.map((idea, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-emerald-600 dark:text-emerald-400 mt-1">💡</span>
                  <span className="text-sm font-medium">{idea}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Недостаточно данных</p>
          )}
        </CardContent>
      </Card>

      {/* Top Quotes */}
      {data.topQuotes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Quote className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              Топ цитаты из комментариев
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.topQuotes.slice(0, 8).map((quote, idx) => (
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
          Анализ сгенерирован: {new Date(data.createdAt).toLocaleString(data.language === "ru" ? "ru-RU" : "en-US")}
          {data.cached && " (из кэша)"}
        </p>
      )}
    </div>
  );
}
