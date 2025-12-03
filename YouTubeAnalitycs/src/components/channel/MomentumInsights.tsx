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

export function MomentumInsights({ channelId, initialData, hasRequiredData = true }: MomentumInsightsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<MomentumData | null>(initialData || null);
  const [error, setError] = useState<string | null>(null);

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
            Momentum Insights
          </CardTitle>
          <CardDescription>
            Что растёт прямо сейчас
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Анализ momentum...</p>
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
            <Flame className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            Momentum Insights
          </CardTitle>
          <CardDescription>
            Что растёт прямо сейчас
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12">
            {!hasRequiredData ? (
              <>
                <p className="text-muted-foreground mb-2 text-center">
                  Для генерации Momentum анализа необходимо синхронизировать видео.
                </p>
                <p className="text-sm text-muted-foreground mb-4 text-center">
                  Нажмите кнопку "Sync Top Videos" выше, чтобы загрузить данные.
                </p>
                <Button onClick={handleGenerate} className="gap-2" disabled title="Сначала синхронизируйте видео">
                  <Flame className="h-4 w-4" />
                  Сгенерировать Momentum анализ
                </Button>
              </>
            ) : (
              <>
                <p className="text-muted-foreground mb-4">
                  Momentum анализ покажет какие темы и форматы набирают популярность прямо сейчас.
                </p>
                <Button onClick={handleGenerate} className="gap-2">
                  <Flame className="h-4 w-4" />
                  Сгенерировать Momentum анализ
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
            Momentum Insights
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Темы и форматы, которые растут прямо сейчас
          </p>
        </div>
        <Button onClick={handleGenerate} variant="outline" size="sm" className="gap-2">
          <Flame className="h-4 w-4" />
          Обновить анализ
        </Button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="text-2xl font-bold">{data.stats.totalAnalyzed}</div>
          <div className="text-xs text-muted-foreground">Проанализировано</div>
        </div>
        <div className="bg-orange-500/10 rounded-lg p-4">
          <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{data.stats.highMomentum}</div>
          <div className="text-xs text-muted-foreground">High Momentum</div>
        </div>
        <div className="bg-blue-500/10 rounded-lg p-4">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{data.stats.rising}</div>
          <div className="text-xs text-muted-foreground">Rising</div>
        </div>
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="text-2xl font-bold">{formatNumber(data.stats.medianViewsPerDay)}</div>
          <div className="text-xs text-muted-foreground">Медиана views/day</div>
        </div>
      </div>

      {/* AI Explanation */}
      <Card className="border-orange-200 dark:border-orange-900 bg-orange-50/50 dark:bg-orange-950/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            Почему эти темы растут
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
              Горячие темы
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
              Успешные форматы
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
              Идеи для контента
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
          <CardTitle className="text-lg">🚀 Видео с высоким Momentum</CardTitle>
          <CardDescription>
            Видео с показами выше медианы на 50%+
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
                    {formatNumber(video.viewCount)} просмотров • {formatNumber(video.viewsPerDay)} views/day
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <div className="text-right">
                    <div className="text-sm font-bold text-orange-600 dark:text-orange-400">
                      +{(video.momentumScore * 100).toFixed(0)}%
                    </div>
                    <div className="text-xs text-muted-foreground">momentum</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
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
