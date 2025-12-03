"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Flame, TrendingUp, Zap, Lightbulb } from "lucide-react";
import { useRouter } from "next/navigation";

interface MomentumVideo {
  videoId: string;
  title: string;
  viewCount: number;
  viewsPerDay: number;
  momentumScore: number;
  publishedAt: string;
}

interface MomentumData {
  highMomentumVideos: MomentumVideo[];
  stats: {
    totalAnalyzed: number;
    highMomentum: number;
    rising: number;
    medianViewsPerDay: number;
  };
  hotThemes: string[];
  hotFormats: string[];
  hotIdeas: string[];
  explanation: string;
  generatedAt?: number;
}

interface MomentumInsightsProps {
  channelId: number;
  initialData?: MomentumData | null;
  hasRequiredData?: boolean;
  analysisLanguage?: "en" | "ru";
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

export function MomentumInsights({
  channelId,
  initialData,
  hasRequiredData = true,
  analysisLanguage = "en"
}: MomentumInsightsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<MomentumData | null>(initialData || null);
  const [error, setError] = useState<string | null>(null);

  // Local dictionary for titles/descriptions only
  const texts = {
    en: {
      title: "Momentum Insights",
      description: "What's growing right now",
      generating: "Analyzing momentum...",
      waitTime: "This may take 15-25 seconds",
      syncFirst: "Sync videos first",
      syncDesc: "Click 'Sync Top Videos' above to load data.",
      generateButton: "Generate Momentum Analysis",
      generateDesc: "Momentum analysis will show which topics and formats are trending right now.",
      refreshButton: "Refresh Analysis",
      statsAnalyzed: "Analyzed",
      statsHighMomentum: "High Momentum",
      statsRising: "Rising",
      statsMedian: "Median views/day",
      whyGrowing: "Why these topics are growing",
      hotThemes: "Hot Themes",
      hotFormats: "Trending Formats",
      hotIdeas: "Content Ideas",
      highMomentumVideos: "High Momentum Videos",
      videosAboveMedian: "Videos with views 50%+ above median",
      views: "views",
      momentum: "momentum"
    },
    ru: {
      title: "Momentum Insights",
      description: "Что растёт прямо сейчас",
      generating: "Анализ momentum...",
      waitTime: "Это может занять 15-25 секунд",
      syncFirst: "Сначала синхронизируйте видео",
      syncDesc: "Нажмите кнопку 'Sync Top Videos' выше, чтобы загрузить данные.",
      generateButton: "Сгенерировать Momentum анализ",
      generateDesc: "Momentum анализ покажет какие темы и форматы набирают популярность прямо сейчас.",
      refreshButton: "Обновить анализ",
      statsAnalyzed: "Проанализировано",
      statsHighMomentum: "High Momentum",
      statsRising: "Rising",
      statsMedian: "Медиана views/day",
      whyGrowing: "Почему эти темы растут",
      hotThemes: "Горячие темы",
      hotFormats: "Успешные форматы",
      hotIdeas: "Идеи для контента",
      highMomentumVideos: "Видео с высоким Momentum",
      videosAboveMedian: "Видео с показами выше медианы на 50%+",
      views: "просмотров",
      momentum: "momentum"
    }
  };

  const t = texts[analysisLanguage];

  async function handleGenerate() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/channel/${channelId}/momentum`, {
        method: "POST",
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to generate momentum analysis");
      }

      const result = await res.json();
      setData(result);

      // Обновляем страницу чтобы показать новые данные
      router.refresh();
    } catch (err) {
      console.error("Error generating momentum analysis:", err);
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
            <Flame className="h-5 w-5 text-orange-600 dark:text-orange-400" />
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
            <Flame className="h-5 w-5 text-orange-600 dark:text-orange-400" />
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
                  <Flame className="h-4 w-4" />
                  {t.generateButton}
                </Button>
              </>
            ) : (
              <>
                <p className="text-muted-foreground mb-4">
                  {t.generateDesc}
                </p>
                <Button onClick={handleGenerate} className="gap-2 cursor-pointer">
                  <Flame className="h-4 w-4" />
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
            <Flame className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            {t.title}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t.description}
          </p>
        </div>
        <Button onClick={handleGenerate} variant="outline" size="sm" className="gap-2 cursor-pointer">
          <Flame className="h-4 w-4" />
          {t.refreshButton}
        </Button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="text-2xl font-bold">{data.stats.totalAnalyzed}</div>
          <div className="text-xs text-muted-foreground">{t.statsAnalyzed}</div>
        </div>
        <div className="bg-orange-500/10 rounded-lg p-4">
          <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{data.stats.highMomentum}</div>
          <div className="text-xs text-muted-foreground">{t.statsHighMomentum}</div>
        </div>
        <div className="bg-blue-500/10 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{data.stats.rising}</div>
          <div className="text-xs text-muted-foreground">{t.statsRising}</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="text-2xl font-bold">{formatNumber(data.stats.medianViewsPerDay)}</div>
          <div className="text-xs text-muted-foreground">{t.statsMedian}</div>
        </div>
      </div>

      {/* AI Explanation */}
      <Card className="border-orange-200 dark:border-orange-900 bg-orange-50/50 dark:bg-orange-950/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            {t.whyGrowing}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{data.explanation}</p>
        </CardContent>
      </Card>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Hot Themes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Flame className="h-5 w-5 text-red-600 dark:text-red-400" />
              {t.hotThemes}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.hotThemes.map((theme, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-red-600 dark:text-red-400 mt-1">🔥</span>
                  <span className="text-sm">{theme}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Hot Formats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
              {t.hotFormats}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.hotFormats.map((format, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-green-600 dark:text-green-400 mt-1">📈</span>
                  <span className="text-sm">{format}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Hot Ideas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
              {t.hotIdeas}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.hotIdeas.map((idea, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-yellow-600 dark:text-yellow-400 mt-1">💡</span>
                  <span className="text-sm">{idea}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* High Momentum Videos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">🚀 {t.highMomentumVideos}</CardTitle>
          <CardDescription>
            {t.videosAboveMedian}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.highMomentumVideos.map((video, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <a
                    href={`https://www.youtube.com/watch?v=${video.videoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-sm line-clamp-1 hover:underline"
                  >
                    {video.title}
                  </a>
                  <div className="text-xs text-muted-foreground mt-1">
                    {formatNumber(video.viewCount)} {t.views} • {formatNumber(video.viewsPerDay)} views/day
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <div className="text-right">
                    <div className="text-sm font-bold text-orange-600 dark:text-orange-400">
                      +{(video.momentumScore * 100).toFixed(0)}%
                    </div>
                    <div className="text-xs text-muted-foreground">{t.momentum}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
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
