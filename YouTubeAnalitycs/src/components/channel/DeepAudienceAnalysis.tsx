"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Brain, Users, Lightbulb, TrendingUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface DeepAudienceData {
  audienceProfile?: string[];
  contentPreferences?: string[];
  engagementPatterns?: string[];
  recommendations?: string[];
  totalAnalyzed?: number;
  channelTitle?: string;
  createdAt?: number;
  hasRussianVersion?: boolean;
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
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DeepAudienceData | null>(initialData || null);
  const [error, setError] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);

  async function handleGenerate() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/channel/${channelId}/deep`, {
        method: "POST",
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to generate deep audience analysis");
      }

      const result = await res.json();
      setData(result);

      // Обновляем страницу чтобы показать новые данные
      router.refresh();
    } catch (err) {
      console.error("Error generating deep audience analysis:", err);
      toast.error(err instanceof Error ? err.message : "Unknown error");
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  async function handleTranslate() {
    setTranslating(true);
    setError(null);

    try {
      console.log('[DeepAudienceAnalysis] Starting translation for channel:', channelId);
      const res = await fetch(`/api/channel/${channelId}/deep/translate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ targetLanguage: "ru" }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        console.error('[DeepAudienceAnalysis] Translation failed:', errorData);
        throw new Error(errorData.error || "Failed to translate analysis");
      }

      const result = await res.json();
      console.log('[DeepAudienceAnalysis] Translation successful, cached:', result.cached);

      // После успешного перевода получаем обновленные данные
      const getRes = await fetch(`/api/channel/${channelId}/deep`, {
        method: "GET",
        credentials: "include",
      });

      if (!getRes.ok) {
        throw new Error("Failed to fetch updated analysis");
      }

      const updatedData = await getRes.json();
      console.log('[DeepAudienceAnalysis] Updated data fetched, hasRussianVersion:', updatedData.hasRussianVersion);

      // Обновляем локальный state
      setData(updatedData);
    } catch (err) {
      console.error("Error translating deep audience analysis:", err);
      toast.error(err instanceof Error ? err.message : "Unknown error");
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setTranslating(false);
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
            Deep AI analysis of audience behavior and preferences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Analyzing audience...</p>
            <p className="text-sm text-muted-foreground mt-2">This may take 15-25 seconds</p>
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
                <Button onClick={handleGenerate} className="gap-2 cursor-pointer" disabled title="Sync data first">
                  <Brain className="h-4 w-4" />
                  Generate Deep Analysis
                </Button>
              </>
            ) : (
              <>
                <p className="text-muted-foreground mb-4">
                  Deep analysis will reveal audience behavior patterns and preferences.
                </p>
                <Button onClick={handleGenerate} className="gap-2 cursor-pointer">
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

  // Выбираем data_ru или data для отображения
  let displayData = data;

  if (data) {
    try {
      // Парсим английскую версию
      const enData = (data as any).data ? JSON.parse((data as any).data) : null;

      // Парсим русскую версию если есть
      const ruData = (data as any).data_ru ? JSON.parse((data as any).data_ru) : null;

      // Если есть русская версия - показываем её, иначе английскую
      displayData = ruData ?? enData;
    } catch (err) {
      console.error('[DeepAudienceAnalysis] Failed to parse analysis data:', err);
      // Используем data как fallback
      displayData = data;
    }
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
            Deep analysis of {displayData.channelTitle || 'channel'} audience
          </p>
        </div>
        <div className="flex gap-2">
          {!(data as any)?.data_ru && (
            <Button
              onClick={handleTranslate}
              disabled={translating}
              variant="outline"
              size="sm"
              className="gap-2 cursor-pointer"
            >
              {translating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Translating...
                </>
              ) : (
                <>
                  🇷🇺 Translate to Russian
                </>
              )}
            </Button>
          )}
          <Button onClick={handleGenerate} variant="outline" size="sm" className="gap-2 cursor-pointer">
            <Brain className="h-4 w-4" />
            Refresh Analysis
          </Button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Audience Profile */}
        {displayData.audienceProfile && displayData.audienceProfile.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                Audience Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {displayData.audienceProfile.map((item, idx) => (
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
        {displayData.contentPreferences && displayData.contentPreferences.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                Content Preferences
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {displayData.contentPreferences.map((pref, idx) => (
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
        {displayData.engagementPatterns && displayData.engagementPatterns.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                Engagement Patterns
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {displayData.engagementPatterns.map((pattern, idx) => (
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
        {displayData.recommendations && displayData.recommendations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {displayData.recommendations.map((rec, idx) => (
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
