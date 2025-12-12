"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Brain, Users, Lightbulb, TrendingUp, RefreshCcw } from "lucide-react";
import { AnalysisLoadingState } from "@/components/ui/AnalysisLoadingState";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useGenerationStatusStore } from "@/store/generationStatusStore";

interface DeepAudienceData {
  audienceProfile?: string[];
  contentPreferences?: string[];
  engagementPatterns?: string[];
  recommendations?: string[];
  totalAnalyzed?: number;
  channelTitle?: string;
  createdAt?: number;
}

interface DeepAudienceAnalysisProps {
  channelId: number;
  initialData?: DeepAudienceData | null;
  hasRequiredData?: boolean;
}

export function DeepAudienceAnalysis({
  channelId,
  initialData,
  hasRequiredData = true
}: DeepAudienceAnalysisProps) {
  const router = useRouter();
  const { getStatus, setStatus } = useGenerationStatusStore();
  const generationKey = `${channelId}:deep-audience`;
  const loading = getStatus(generationKey) === "loading";
  const [data, setData] = useState<DeepAudienceData | null>(initialData || null);
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
      const res = await fetch(`/api/channel/${channelId}/deep`, {
        method: "POST",
      });

      if (!res.ok) {
        const errorData = await res.json();
        setStatus(generationKey, "error");
        throw new Error(errorData.error || "Failed to generate deep audience analysis");
      }

      const result = await res.json();
      setData(result);
      setCooldownUntil(Date.now() + COOLDOWN_MS);
      setStatus(generationKey, "success");

      // Обновляем страницу чтобы показать новые данные
      router.refresh();
    } catch (err) {
      console.error("Error generating deep audience analysis:", err);
      toast.error(err instanceof Error ? err.message : "Unknown error");
      setError(err instanceof Error ? err.message : "Unknown error");
      setStatus(generationKey, "error");
    }
  }

  if (loading) {
    return (
      <AnalysisLoadingState
        title="Generating deep analysis..."
        subtitle="This may take 20-30 seconds"
      />
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
            Deep AI analysis of audience behavior and preferences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12">
            {!hasRequiredData ? (
              <>
                <p className="text-muted-foreground mb-2 text-center">
                  Sync channel data first
                </p>
                <p className="text-sm text-muted-foreground mb-4 text-center">
                  Click 'Sync Top Videos' above to load data.
                </p>
                <Button variant="default" onClick={handleGenerate} className="gap-2 cursor-pointer" disabled title="Sync data first">
                  <Brain className="h-4 w-4" />
                  Generate Deep Analysis
                </Button>
              </>
            ) : (
              <>
                <p className="text-muted-foreground mb-4">
                  Deep analysis will reveal audience behavior patterns and preferences.
                </p>
                <Button variant="default" onClick={handleGenerate} className="gap-2 cursor-pointer">
                  <Brain className="h-4 w-4" />
                  Generate Deep Analysis
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
            <Brain className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
            Deep Audience Intelligence (AI v2.0)
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Deep analysis of {data.channelTitle || 'channel'} audience
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

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Audience Profile */}
        {data.audienceProfile && data.audienceProfile.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                Audience Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {data.audienceProfile.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-blue-600 dark:text-blue-400 mt-1">▪</span>
                    <span className="text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Content Preferences */}
        {data.contentPreferences && data.contentPreferences.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                Content Preferences
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {data.contentPreferences.map((pref, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-green-600 dark:text-green-400 mt-1">▪</span>
                    <span className="text-sm">{pref}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Engagement Patterns */}
        {data.engagementPatterns && data.engagementPatterns.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                Engagement Patterns
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {data.engagementPatterns.map((pattern, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-purple-600 dark:text-purple-400 mt-1">▪</span>
                    <span className="text-sm">{pattern}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Recommendations */}
        {data.recommendations && data.recommendations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {data.recommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-yellow-600 dark:text-yellow-400 mt-1">💡</span>
                    <span className="text-sm">{rec}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {data.createdAt && (
        <p className="text-xs text-muted-foreground text-center">
          Analysis generated: {new Date(data.createdAt).toLocaleString("en-US")}
        </p>
      )}
    </div>
  );
}
