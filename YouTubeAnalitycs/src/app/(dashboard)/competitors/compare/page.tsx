"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, AlertCircle, ArrowUpDown, ArrowUp, ArrowDown, Sparkles } from "lucide-react";
import Link from "next/link";
import { ChannelAvatar } from "@/components/channel-avatar";

interface CompetitorSummary {
  channelId: string;
  handle: string;
  title: string;
  avatarUrl?: string;
  subscribers: number;
  viewsTotal: number;
  videoCount: number;
  avgViewsPerVideo: number;
  lastSyncedAt: number;
  viewsPerDay: number | null;
  growth7d: number | null;
}

interface AIAnalysisResult {
  summary: string;
  leaders: string[];
  laggards: string[];
  strategies: string[];
  recommendations: string[];
}

type SortField = "subscribers" | "viewsTotal" | "videoCount" | "avgViewsPerVideo" | "viewsPerDay" | "growth7d";
type SortDirection = "asc" | "desc";

export default function ComparePage() {
  const { data: session } = useSession();
  const [competitors, setCompetitors] = useState<CompetitorSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sortField, setSortField] = useState<SortField>("subscribers");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysisResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  // Ref для блокировки race condition между fetchSavedAnalysis и generateAIAnalysis
  const isRegeneratingRef = useRef(false);

  useEffect(() => {
    fetchCompetitors();
    fetchSavedAnalysis();
  }, []);

  async function fetchCompetitors() {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/competitors/compare");

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to fetch competitors");
        return;
      }

      const data = await res.json();
      setCompetitors(data.competitors || []);
    } catch (err) {
      console.error("Error fetching competitors:", err);
      setError("Failed to load competitors");
    } finally {
      setLoading(false);
    }
  }

  async function fetchSavedAnalysis() {
    // Не загружаем, если уже идёт регенерация
    if (isRegeneratingRef.current) {
      return;
    }

    try {
      const res = await fetch("/api/competitors/compare/ai/get");

      if (!res.ok) {
        // Если нет сохранённого анализа, это нормально
        return;
      }

      const data = await res.json();
      // Проверяем ещё раз перед записью (защита от race condition)
      if (data.analysis && !isRegeneratingRef.current) {
        setAiAnalysis(data.analysis);
        console.log("Loaded saved analysis from", new Date(data.generatedAt).toLocaleString());
      }
    } catch (err) {
      console.error("Error fetching saved analysis:", err);
      // Не показываем ошибку пользователю, это не критично
    }
  }

  function handleSort(field: SortField) {
    if (sortField === field) {
      // Toggle direction
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // New field, default to descending
      setSortField(field);
      setSortDirection("desc");
    }
  }

  function getSortedCompetitors(): CompetitorSummary[] {
    const sorted = [...competitors].sort((a, b) => {
      const aVal = a[sortField];
      const bVal = b[sortField];

      // Обработка null значений (null всегда в конце)
      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1; // null в конец
      if (bVal === null) return -1; // null в конец

      if (sortDirection === "asc") {
        return (aVal as number) - (bVal as number);
      } else {
        return (bVal as number) - (aVal as number);
      }
    });

    return sorted;
  }

  function formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + "M";
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + "K";
    }
    return num.toString();
  }

  function formatViewsPerDay(viewsPerDay: number | null): React.ReactNode {
    if (viewsPerDay === null) return "—";

    const formatted = formatNumber(Math.abs(viewsPerDay));
    const colorClass = viewsPerDay > 0 ? "text-green-600" : viewsPerDay < 0 ? "text-red-600" : "text-foreground";

    return (
      <span className={colorClass}>
        {viewsPerDay > 0 ? "+" : viewsPerDay < 0 ? "-" : ""}{formatted}
      </span>
    );
  }

  function formatGrowth7d(growth7d: number | null): React.ReactNode {
    if (growth7d === null) return "—";

    let icon = "";
    let colorClass = "";

    if (growth7d > 0) {
      icon = "↑";
      colorClass = "text-green-600";
    } else if (growth7d < 0) {
      icon = "↓";
      colorClass = "text-red-600";
    } else {
      icon = "→";
      colorClass = "text-yellow-600";
    }

    const formatted = formatNumber(Math.abs(growth7d));

    return (
      <span className={colorClass}>
        {icon} {formatted}
      </span>
    );
  }

  function formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString();
  }

  function renderSortIcon(field: SortField) {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-2 h-4 w-4 inline" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="ml-2 h-4 w-4 inline" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4 inline" />
    );
  }

  async function generateAIAnalysis() {
    // Блокируем fetchSavedAnalysis от перезаписи результата
    isRegeneratingRef.current = true;

    try {
      setAiLoading(true);
      setAiError("");

      const res = await fetch("/api/competitors/compare/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competitors }),
      });

      if (!res.ok) {
        const data = await res.json();
        setAiError(data.error || "Failed to generate AI analysis");
        return;
      }

      const analysis = await res.json();
      setAiAnalysis(analysis);
    } catch (err) {
      console.error("Error generating AI analysis:", err);
      setAiError("Failed to generate AI analysis");
    } finally {
      setAiLoading(false);
      isRegeneratingRef.current = false;
    }
  }

  const sortedCompetitors = getSortedCompetitors();

  return (
    <div className="container mx-auto px-4 md:px-6 space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Compare Competitors</h1>
          <p className="text-muted-foreground">Side-by-side comparison of all your tracked channels</p>
        </div>
        <Link href="/competitors">
          <Button variant="outline">Back to Competitors</Button>
        </Link>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Competitors Comparison</CardTitle>
          <CardDescription>
            Compare metrics across all your tracked competitors. Click column headers to sort.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : competitors.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                No competitors to compare yet. Add competitors first.
              </p>
              <Link href="/competitors">
                <Button>Add Competitors</Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Channel</TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("subscribers")}
                    >
                      Subscribers {renderSortIcon("subscribers")}
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("viewsTotal")}
                    >
                      Total Views {renderSortIcon("viewsTotal")}
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("videoCount")}
                    >
                      Videos {renderSortIcon("videoCount")}
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("avgViewsPerVideo")}
                    >
                      Avg Views/Video {renderSortIcon("avgViewsPerVideo")}
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("viewsPerDay")}
                    >
                      Views/Day {renderSortIcon("viewsPerDay")}
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("growth7d")}
                    >
                      Growth 7d {renderSortIcon("growth7d")}
                    </TableHead>
                    <TableHead>Last Synced</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedCompetitors.map((competitor) => (
                    <TableRow key={competitor.channelId}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <ChannelAvatar
                            src={competitor.avatarUrl}
                            alt={competitor.title}
                            className="h-10 w-10"
                          />
                          <div>
                            <div className="font-medium">{competitor.title}</div>
                            <div className="text-xs text-muted-foreground">
                              {competitor.handle}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatNumber(competitor.subscribers)}
                      </TableCell>
                      <TableCell>{formatNumber(competitor.viewsTotal)}</TableCell>
                      <TableCell>{formatNumber(competitor.videoCount)}</TableCell>
                      <TableCell className="font-medium">
                        {formatNumber(competitor.avgViewsPerVideo)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatViewsPerDay(competitor.viewsPerDay)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatGrowth7d(competitor.growth7d)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(competitor.lastSyncedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {competitors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              AI Comparative Analysis
            </CardTitle>
            <CardDescription>
              Get AI-powered insights comparing all your competitors
            </CardDescription>
          </CardHeader>
          <CardContent>
            {aiError && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{aiError}</AlertDescription>
              </Alert>
            )}

            {!aiAnalysis ? (
              <div>
                <p className="text-sm text-muted-foreground mb-4">
                  Generate AI-powered comparative analysis of your competitors. This will analyze
                  their strengths, weaknesses, and provide strategic recommendations.
                </p>
                <Button onClick={generateAIAnalysis} disabled={aiLoading}>
                  {aiLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate AI Analysis
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h3 className="font-semibold text-lg mb-2">Summary</h3>
                  <p className="text-sm text-muted-foreground">{aiAnalysis.summary}</p>
                </div>

                {aiAnalysis.leaders.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Leaders</h3>
                    <ul className="list-disc list-inside space-y-1">
                      {aiAnalysis.leaders.map((leader, index) => (
                        <li key={index} className="text-sm text-muted-foreground">
                          {leader}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {aiAnalysis.laggards.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Lagging Channels</h3>
                    <ul className="list-disc list-inside space-y-1">
                      {aiAnalysis.laggards.map((laggard, index) => (
                        <li key={index} className="text-sm text-muted-foreground">
                          {laggard}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {aiAnalysis.strategies.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Observed Strategies</h3>
                    <ul className="list-disc list-inside space-y-1">
                      {aiAnalysis.strategies.map((strategy, index) => (
                        <li key={index} className="text-sm text-muted-foreground">
                          {strategy}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {aiAnalysis.recommendations.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Recommendations</h3>
                    <ul className="list-disc list-inside space-y-1">
                      {aiAnalysis.recommendations.map((recommendation, index) => (
                        <li key={index} className="text-sm text-muted-foreground">
                          {recommendation}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <Button
                  variant="outline"
                  onClick={generateAIAnalysis}
                  disabled={aiLoading}
                >
                  {aiLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    "Regenerate Analysis"
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
