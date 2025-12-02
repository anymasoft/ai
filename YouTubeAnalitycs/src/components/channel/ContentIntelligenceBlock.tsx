"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, TrendingUp, Lightbulb, Target, BarChart3 } from "lucide-react";
import { useRouter } from "next/navigation";

interface ContentIntelligenceData {
  themes: string[];
  formats: string[];
  patterns: string[];
  opportunities: string[];
  recommendations: string[];
  generatedAt?: number;
}

interface ContentIntelligenceBlockProps {
  channelId: number;
  initialData?: ContentIntelligenceData | null;
}

export function ContentIntelligenceBlock({ channelId, initialData }: ContentIntelligenceBlockProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ContentIntelligenceData | null>(initialData || null);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/channel/${channelId}/content-intelligence`, {
        method: "POST",
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to generate analysis");
      }

      const result = await res.json();
      setData(result);

      // Обновляем страницу чтобы показать новые данные
      router.refresh();
    } catch (err) {
      console.error("Error generating content intelligence:", err);
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
            <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            AI Content Patterns
          </CardTitle>
          <CardDescription>
            Анализ контента и выявление успешных паттернов
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Генерация AI-аналитики...</p>
            <p className="text-sm text-muted-foreground mt-2">Это может занять 10-20 секунд</p>
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
            <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            AI Content Patterns
          </CardTitle>
          <CardDescription>
            Анализ контента и выявление успешных паттернов
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">
              AI-анализ контента поможет выявить темы, форматы и паттерны успешных видео.
            </p>
            <Button onClick={handleGenerate} className="gap-2">
              <Sparkles className="h-4 w-4" />
              Сгенерировать AI-аналитику контента
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
            <Sparkles className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            AI Content Patterns
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Анализ успешных паттернов контента канала
          </p>
        </div>
        <Button onClick={handleGenerate} variant="outline" size="sm" className="gap-2">
          <Sparkles className="h-4 w-4" />
          Обновить анализ
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Themes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              Темы, которые дают просмотры
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.themes.map((theme, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-400 mt-1">•</span>
                  <span className="text-sm">{theme}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Formats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-green-600 dark:text-green-400" />
              Сильные форматы у конкурентов
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.formats.map((format, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-green-600 dark:text-green-400 mt-1">•</span>
                  <span className="text-sm">{format}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Patterns */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              Повторяющиеся паттерны
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.patterns.map((pattern, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-orange-600 dark:text-orange-400 mt-1">•</span>
                  <span className="text-sm">{pattern}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Opportunities */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              Возможности роста
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.opportunities.map((opportunity, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-purple-600 dark:text-purple-400 mt-1">•</span>
                  <span className="text-sm">{opportunity}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Recommendations - Full Width */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            Рекомендации что снимать
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

      {data.generatedAt && (
        <p className="text-xs text-muted-foreground text-center">
          Анализ сгенерирован: {new Date(data.generatedAt).toLocaleString("ru-RU")}
        </p>
      )}
    </div>
  );
}
