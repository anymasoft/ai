"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Loader2,
  Brain,
  Heart,
  AlertCircle,
  MessageSquare,
  Users,
  Lightbulb,
  TrendingUp,
  Quote,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { CombinedDeepAnalysis } from "@/lib/ai/comments-analysis";

interface DeepCommentAnalysisProps {
  channelId: number;
  initialData?: (CombinedDeepAnalysis & {
    cached?: boolean;
    createdAt?: number;
    hasRussianVersion?: boolean;
    data?: string;
    data_ru?: string;
  }) | null;
  hasRequiredData?: boolean;
  analysisLanguage?: "en" | "ru";
}

interface ProgressData {
  status: string;
  progress_current: number;
  progress_total: number;
  percent: number;
}

export function DeepCommentAnalysis({
  channelId,
  initialData,
  hasRequiredData = true,
  analysisLanguage = "en",
}: DeepCommentAnalysisProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [data, setData] = useState<any>(initialData || null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressData | null>(null);

  // Обновляем локальные данные при изменении initialData
  useEffect(() => {
    if (initialData) {
      setData(initialData);
    }
  }, [initialData]);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/channel/${channelId}/comments/ai`, {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || "Failed to generate analysis");
      }

      router.refresh();
    } catch (err) {
      toast.error("Generation failed");
      setError("Generation failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleTranslate() {
    if (!data || !data.data) {
      toast.error("Run English analysis first");
      return;
    }

    setTranslating(true);
    setError(null);

    try {
      const res = await fetch(`/api/channel/${channelId}/comments/ai/translate`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: "ru" }),
      });

      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || "Translation failed");
      }

      // После перевода — сразу забираем свежие данные
      const getRes = await fetch(`/api/channel/${channelId}/comments/ai`, {
        method: "GET",
        credentials: "include",
      });

      if (!getRes.ok) throw new Error("Failed to fetch updated data");

      const updated = await getRes.json();

      updated.hasRussianVersion = !!updated.data_ru;

      setData(updated);
    } catch (err) {
      toast.error("Translation failed");
      setError("Translation failed");
    } finally {
      setTranslating(false);
    }
  }

  // Парсинг английской и русской версии
  let displayData = data;
  try {
    const en = data?.data ? JSON.parse(data.data) : data;
    const ru = data?.data_ru ? JSON.parse(data.data_ru) : null;

    displayData = ru ?? en;
  } catch {
    displayData = data;
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-indigo-600" />
            Deep Audience Intelligence (AI v2.0)
          </CardTitle>
          <CardDescription>Deep analysis of comments</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleGenerate}>Generate Deep Analysis</Button>
          {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
        </CardContent>
      </Card>
    );
  }

  const sentiment = displayData.sentimentSummary ?? {
    positive: 0,
    neutral: 0,
    negative: 0,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-indigo-600" />
            Deep Audience Intelligence (AI v2.0)
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Deep AI analysis of {displayData.totalAnalyzed} comments
          </p>
        </div>

        <div className="flex gap-2">
          {!data.data_ru && (
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
                <>🇷🇺 Translate to Russian</>
              )}
            </Button>
          )}

          <Button onClick={handleGenerate} variant="outline" size="sm" className="gap-2">
            <Brain className="h-4 w-4" />
            Refresh Analysis
          </Button>
        </div>
      </div>

      {/* SENTIMENT */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Audience Emotional Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{sentiment.positive}%</div>
              <div className="text-xs mt-1">Positive</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-600">{sentiment.neutral}%</div>
              <div className="text-xs mt-1">Neutral</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600">{sentiment.negative}%</div>
              <div className="text-xs mt-1">Negative</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* THEMES */}
      {displayData.themes?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Top Themes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {displayData.themes.map((t: string, i: number) => (
                <li key={i} className="flex items-start gap-2">
                  ▪ <span>{t}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Pain Points */}
      {displayData.painPoints?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              Audience Pain Points
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {displayData.painPoints.map((p: string, i: number) => (
                <li key={i} className="flex items-start gap-2">
                  ⚠ <span>{p}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* REQUESTS */}
      {displayData.requests?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-purple-600" />
              Audience Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {displayData.requests.map((r: string, i: number) => (
                <li key={i}>💬 {r}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* PRAISES */}
      {displayData.praises?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Heart className="h-5 w-5 text-pink-600" />
              What They Like
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {displayData.praises.map((p: string, i: number) => (
                <li key={i}>♥ {p}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* SEGMENTS */}
      {displayData.audienceSegments?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Audience Segments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {displayData.audienceSegments.map((s: string, i: number) => (
                <span key={i} className="px-3 py-1 bg-cyan-100 rounded-full text-sm">
                  {s}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* HIDDEN PATTERNS */}
      {displayData.hiddenPatterns?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Hidden Patterns</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {displayData.hiddenPatterns.map((p: string, i: number) => (
                <li key={i}>→ {p}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* ACTIONABLE IDEAS */}
      {displayData.actionableIdeas?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Actionable Recommendations</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {displayData.actionableIdeas.map((a: string, i: number) => (
                <li key={i}>💡 {a}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* TOP QUOTES */}
      {displayData.topQuotes?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Quotes from Comments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {displayData.topQuotes.slice(0, 8).map((quote: string, i: number) => (
                <blockquote key={i} className="pl-4 border-l-2 text-sm italic">
                  "{quote}"
                </blockquote>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
