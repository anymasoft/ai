"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Flame, TrendingUp, Zap, Lightbulb, RefreshCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { formatMomentumPercent } from "@/lib/momentum-formatting";
import { useGenerationStatusStore } from "@/store/generationStatusStore";
import { AnalysisLoadingState } from "@/components/ui/AnalysisLoadingState";

interface MomentumVideo {
  videoId: string;
  title: string;
  viewCount: number;
  viewsPerDay: number;
  momentumScore: number;
  publishDate: string;
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
  channelId: string;
  competitorId: number;
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

export function MomentumInsights({
  channelId,
  competitorId,
  initialData,
  hasRequiredData = true
}: MomentumInsightsProps) {
  const router = useRouter();
  const { getStatus, setStatus } = useGenerationStatusStore();
  const generationKey = `${competitorId}:momentum-detail`;
  const loading = getStatus(generationKey) === "loading";

  const [data, setData] = useState<MomentumData | null>(initialData || null);
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

  async function handleGenerate() {
    setStatus(generationKey, "loading");
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
      setCooldownUntil(Date.now() + COOLDOWN_MS);
      setStatus(generationKey, "success");

      // Обновляем страницу чтобы показать новые данные
      router.refresh();
    } catch (err) {
      console.error("Error generating momentum analysis:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setStatus(generationKey, "error");
    }
  }

  if (loading) {
    return (
      <AnalysisLoadingState
        title="Анализирование momentum...""
        subtitle="This may take 15-25 seconds"
      />
    );
  }

  if (!data) {
    return (
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-col items-center justify-center py-12">
          {!hasRequiredData ? (
            <>
              <p className="text-muted-foreground mb-2 text-center">
                Sync Top Videos first
              </p>
              <p className="text-sm text-muted-foreground mb-4 text-center">
                Click 'Sync Top Videos' above to load data.
              </p>
              <Button variant="default" onClick={handleGenerate} className="gap-2 cursor-pointer" disabled title="Sync Top Videos first">
                <Flame className="h-4 w-4" />
                Generate Momentum Analysis
              </Button>
            </>
          ) : (
            <>
              <p className="text-muted-foreground mb-4">
                Momentum analysis will show which topics and formats are trending right now.
              </p>
              <Button variant="default" onClick={handleGenerate} className="gap-2 cursor-pointer">
                <Flame className="h-4 w-4" />
                Generate Momentum Analysis
              </Button>
            </>
          )}
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
            <Flame className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            Momentum Insights
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            What's growing right now
          </p>
        </div>
        <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={handleGenerate}
            size="icon"
            variant="outline"
            disabled={isCooldownActive}
          >
            <RefreshCcw className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {isCooldownActive && getCooldownTimeRemaining()
            ? `Available in ${getCooldownTimeRemaining()!.hours}h ${getCooldownTimeRemaining()!.minutes}m`
            : "Refresh Analysis"}
        </TooltipContent>
      </Tooltip>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="text-2xl font-bold">{data.stats.totalAnalyzed}</div>
          <div className="text-xs text-muted-foreground">Analyzed</div>
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
          <div className="text-xs text-muted-foreground">Median views/day</div>
        </div>
      </div>

      {/* AI Explanation */}
      <Card className="border-orange-200 dark:border-orange-900 bg-orange-50/50 dark:bg-orange-950/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Zap className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            Why these topics are growing
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
              Hot Themes
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
              Trending Formats
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
              Content Ideas
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
          <CardTitle className="text-lg">🚀 High Momentum Videos</CardTitle>
          <CardDescription>
            Videos with views 50%+ above median
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
                    {formatNumber(video.viewCount)} views • {formatNumber(video.viewsPerDay)} views/day
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <div className="text-right">
                    <div className="text-sm font-bold text-orange-600 dark:text-orange-400">
                      {formatMomentumPercent(video.momentumScore)}
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
          Analysis generated: {new Date(data.generatedAt).toLocaleString("en-US")}
        </p>
      )}
    </CardContent>
  );
}
