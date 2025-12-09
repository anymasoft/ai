"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, TrendingUp, Film, Lightbulb, ListChecks } from "lucide-react";
import type { MomentumVideo } from "@/lib/momentum-queries";

interface TrendingInsightsProps {
  videos: MomentumVideo[];
}

interface AIInsights {
  summary: string;
  themes: string[];
  formats: string[];
  recommendations: string[];
}

export default function TrendingInsights({ videos }: TrendingInsightsProps) {
  const [insights, setInsights] = useState<AIInsights | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Загрузка сохраненного анализа при инициализации
  useEffect(() => {
    loadSavedInsights();
  }, []);

  const loadSavedInsights = async () => {
    try {
      setLoadingSaved(true);
      const response = await fetch("/api/trending/insights");

      if (!response.ok) {
        throw new Error("Ошибка загрузки сохраненного анализа");
      }

      const data = await response.json();

      if (data.success && data.hasInsights) {
        setInsights(data.insights);
      }
    } catch (err) {
      console.error("Ошибка загрузки сохраненных insights:", err);
      // Не показываем ошибку пользователю, просто не загружаем сохраненный анализ
    } finally {
      setLoadingSaved(false);
    }
  };

  const generateInsights = async () => {
    if (videos.length === 0) {
      setError("Нет видео для анализа");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Подготавливаем данные для API
      const videoData = videos.map(video => ({
        title: video.title,
        channelTitle: video.channelTitle,
        momentumScore: video.momentumScore,
        viewsPerDay: video.viewsPerDay,
        publishDate: video.publishDate,
      }));

      const response = await fetch("/api/trending/insights", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ videos: videoData }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Ошибка генерации анализа");
      }

      if (data.success) {
        setInsights(data.insights);
      } else {
        throw new Error(data.error || "Не удалось сгенерировать анализ");
      }
    } catch (err) {
      console.error("Ошибка генерации AI Insights:", err);
      setError(err instanceof Error ? err.message : "Неизвестная ошибка");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              AI Trending Insights
            </CardTitle>
            <CardDescription>
              Анализ трендовых видео с помощью искусственного интеллекта
            </CardDescription>
          </div>
          <Button
            onClick={generateInsights}
            disabled={loading || videos.length === 0}
            className="gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Генерация...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Сгенерировать анализ
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={generateInsights}
              className="mt-2"
              disabled={loading}
            >
              Попробовать снова
            </Button>
          </div>
        )}

        {videos.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              Добавьте конкурентов и синхронизируйте видео, чтобы получить AI-анализ
            </p>
          </div>
        ) : !insights ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                  <h3 className="font-medium">Анализ трендов</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Определение растущих тем и форматов на основе momentum score
                </p>
              </div>

              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Film className="h-4 w-4 text-green-500" />
                  <h3 className="font-medium">Форматы контента</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Выявление успешных форматов видео (интервью, обзоры, влоги и т.д.)
                </p>
              </div>

              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Lightbulb className="h-4 w-4 text-yellow-500" />
                  <h3 className="font-medium">Рекомендации</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Практичные советы по созданию трендового контента
                </p>
              </div>
            </div>

            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-2">
                Готово к анализу {videos.length} видео
              </p>
              <p className="text-xs text-muted-foreground">
                Нажмите "Сгенерировать анализ" для получения AI-инсайтов
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Краткое резюме */}
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <ListChecks className="h-4 w-4" />
                Краткое резюме
              </h3>
              <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
                {insights.summary}
              </p>
            </div>

            {/* Трендовые темы */}
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                Трендовые темы
              </h3>
              <div className="flex flex-wrap gap-2">
                {insights.themes.map((theme, index) => (
                  <Badge key={index} variant="secondary" className="px-3 py-1">
                    {theme}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Популярные форматы */}
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Film className="h-4 w-4 text-green-500" />
                Популярные форматы
              </h3>
              <div className="flex flex-wrap gap-2">
                {insights.formats.map((format, index) => (
                  <Badge key={index} variant="outline" className="px-3 py-1">
                    {format}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Рекомендации */}
            <div>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-yellow-500" />
                Рекомендации для создания контента
              </h3>
              <ul className="space-y-2">
                {insights.recommendations.map((recommendation, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <span className="text-muted-foreground mt-1">•</span>
                    <span>{recommendation}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={generateInsights}
                disabled={loading}
                className="gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Обновление анализа...
                  </>
                ) : (
                  "Обновить анализ"
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
