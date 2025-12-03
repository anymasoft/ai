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
  hasRequiredData?: boolean;
  analysisLanguage?: "en" | "ru";
}

export function ContentIntelligenceBlock({
  channelId,
  initialData,
  hasRequiredData = true,
  analysisLanguage = "en"
}: ContentIntelligenceBlockProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ContentIntelligenceData | null>(initialData || null);
  const [error, setError] = useState<string | null>(null);

  // Local dictionary for titles/descriptions only
  const texts = {
    en: {
      title: "AI Content Patterns",
      description: "Content analysis and successful patterns identification",
      generating: "Generating AI analysis...",
      waitTime: "This may take 10-20 seconds",
      noData: "Content Intelligence analysis not yet generated",
      generateDesc: "AI will analyze video metadata to identify successful content patterns.",
      generateButton: "Generate Analysis",
      refreshButton: "Refresh Analysis",
      syncFirst: "Sync videos first",
      syncDesc: "Click 'Sync Top Videos' above to load data.",
      themes: "Content Themes",
      formats: "Popular Formats",
      patterns: "Success Patterns",
      opportunities: "Content Opportunities",
      recommendations: "Recommendations"
    },
    ru: {
      title: "AI Паттерны контента",
      description: "Анализ контента и выявление успешных паттернов",
      generating: "Генерация AI-аналитики...",
      waitTime: "Это может занять 10-20 секунд",
      noData: "Анализ Content Intelligence ещё не сгенерирован",
      generateDesc: "AI проанализирует метаданные видео и определит успешные паттерны контента.",
      generateButton: "Сгенерировать анализ",
      refreshButton: "Обновить анализ",
      syncFirst: "Сначала синхронизируйте видео",
      syncDesc: "Нажмите 'Sync Top Videos' выше для загрузки данных.",
      themes: "Темы контента",
      formats: "Популярные форматы",
      patterns: "Паттерны успеха",
      opportunities: "Возможности для контента",
      recommendations: "Рекомендации"
    }
  };

  const t = texts[analysisLanguage];

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
            {t.title}
          </CardTitle>
          <CardDescription>
            {t.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <p className="text-muted-foreground">{t.generating}</p>
            <p className="text-sm text-muted-foreground mt-2">{t.waitTime}</p>
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
            {t.title}
          </CardTitle>
          <CardDescription>
            {t.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12">
            {!hasRequiredData ? (
              <>
                <p className="text-muted-foreground mb-2 text-center">
                  {t.syncFirst}
                </p>
                <p className="text-sm text-muted-foreground mb-4 text-center">
                  {t.syncDesc}
                </p>
                <Button onClick={handleGenerate} className="gap-2 cursor-pointer" disabled title={t.syncFirst}>
                  <Sparkles className="h-4 w-4" />
                  {t.generateButton}
                </Button>
              </>
            ) : (
              <>
                <p className="text-muted-foreground mb-4">
                  {t.generateDesc}
                </p>
                <Button onClick={handleGenerate} className="gap-2 cursor-pointer">
                  <Sparkles className="h-4 w-4" />
                  {t.generateButton}
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            {t.title}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t.description}
          </p>
        </div>
        <Button onClick={handleGenerate} variant="outline" size="sm" className="gap-2 cursor-pointer">
          <Sparkles className="h-4 w-4" />
          {t.refreshButton}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Themes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              {t.themes}
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
              {t.formats}
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
              {t.patterns}
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
              {t.opportunities}
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
            {t.recommendations}
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
          Analysis generated: {new Date(data.generatedAt).toLocaleString("en-US")}
        </p>
      )}
    </div>
  );
}
