"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import {
  Brain,
  Heart,
  AlertCircle,
  MessageSquare,
  Users,
  Lightbulb,
  TrendingUp,
  Quote,
  RefreshCcw,
} from "lucide-react";
import { AnalysisLoadingState } from "@/components/ui/AnalysisLoadingState";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { CombinedDeepAnalysis } from "@/lib/ai/comments-analysis";
import { useGenerationStatusStore } from "@/store/generationStatusStore";

interface DeepCommentAnalysisProps {
  channelId: string;
  competitorId: number;
  initialData?: (CombinedDeepAnalysis & {
    cached?: boolean;
    createdAt?: number;
  }) | null;
  hasRequiredData?: boolean;
}

interface ProgressData {
  status: string;
  progress_current: number;
  progress_total: number;
  percent: number;
}

export function DeepCommentAnalysis({
  channelId,
  competitorId,
  initialData,
  hasRequiredData = true,
}: DeepCommentAnalysisProps) {
  const router = useRouter();
  const { getStatus, setStatus } = useGenerationStatusStore();
  const generationKey = `${competitorId}:deep-comment`;
  const loading = getStatus(generationKey) === "loading";

  const [data, setData] = useState<any>(initialData || null);
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
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const intervalRef = useRef<number | NodeJS.Timeout | null>(null);

  // Обновляем локальные данные при изменении initialData
  useEffect(() => {
    if (initialData) {
      setData(initialData);
    }
  }, [initialData]);

  // Очистка интервала при размонтировании
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current as any);
      }
    };
  }, []);

  async function handleGenerate() {
    setStatus(generationKey, "loading");
    setError(null);
    setProgress(null);

    try {
      // Запускаем анализ
      const res = await fetch(`/api/channel/${channelId}/comments/ai`, {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || "Не удалось сгенерировать анализ");
      }

      // Начинаем поллинг прогресса
      startPolling();
    } catch (err) {
      toast.error("Ошибка генерации");
      setError("Ошибка генерации");
      setStatus(generationKey, "error");
    }
  }

  function startPolling() {
    if (!channelId) return;

    const fetchProgress = async () => {
      try {
        const res = await fetch(`/api/channel/${channelId}/comments/ai/progress`, {
          credentials: "include",
        });
        if (!res.ok) {
          console.warn("[DeepCommentAnalysis] Progress fetch not ok:", res.status);
          return;
        }
        const progressData = await res.json();
        console.log("[DeepCommentAnalysis] Progress data:", progressData);
        setProgress(progressData);

        if (progressData.status === "done" || progressData.status === "error") {
          if (intervalRef.current) {
            clearInterval(intervalRef.current as any);
            intervalRef.current = null;
          }
          if (progressData.status === "done") {
            setCooldownUntil(Date.now() + COOLDOWN_MS);
            setStatus(generationKey, "success");
            router.refresh();
          } else {
            setStatus(generationKey, "error");
          }
        }
      } catch (err) {
        console.error("[DeepCommentAnalysis] Error fetching progress:", err);
      }
    };

    // начальный запрос
    fetchProgress();
    // интервальный polling
    if (intervalRef.current) clearInterval(intervalRef.current as any);
    intervalRef.current = setInterval(fetchProgress, 1500);
  }

  if (loading) {
    return (
      <AnalysisLoadingState
        title="Анализирование комментариев..."
        subtitle="Это может занять 15-25 секунд"
      />
    );
  }

  if (!data) {
    return (
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-col items-center justify-center py-6">
          {!hasRequiredData ? (
            <>
              <p className="text-muted-foreground mb-2 text-center">
                Сначала синхронизируйте комментарии
              </p>
              <p className="text-sm text-muted-foreground mb-4 text-center">
                Нажмите кнопку 'Синхронизировать комментарии' выше, чтобы загрузить данные.
              </p>
              <Button variant="default" onClick={handleGenerate} disabled title="Сначала синхронизируйте комментарии" className="gap-2">
                <Brain className="h-4 w-4" />
                Генерировать глубокий анализ
              </Button>
            </>
          ) : (
            <>
              <p className="text-muted-foreground mb-4">
                Глубокий анализ ИИ комментариев аудитории.
              </p>
              <Button variant="default" onClick={handleGenerate} className="gap-2">
                <Brain className="h-4 w-4" />
                Генерировать глубокий анализ
              </Button>
            </>
          )}
          {error && <p className="text-red-600 text-sm mt-3">{error}</p>}
        </div>
      </CardContent>
    );
  }

  const sentiment = data.sentiment ?? data.sentimentSummary ?? {
    positive: 0,
    neutral: 0,
    negative: 0,
  };

  // Вычисляем проценты на основе totalAnalyzed
  const total = sentiment.positive + sentiment.neutral + sentiment.negative;

  // Рассчитываем проценты так, чтобы их сумма была ровно 100%
  let positivePercent: number;
  let neutralPercent: number;
  let negativePercent: number;

  if (total === 0) {
    positivePercent = 0;
    neutralPercent = 0;
    negativePercent = 0;
  } else {
    positivePercent = Math.round((sentiment.positive / total) * 100);
    negativePercent = Math.round((sentiment.negative / total) * 100);
    neutralPercent = 100 - positivePercent - negativePercent;

    // Защита от крайних случаев
    if (neutralPercent < 0) {
      neutralPercent = 0;
    }
  }

  return (
    <CardContent className="space-y-4 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-indigo-600" />
            Глубокий интеллект аудитории (ИИ v2.1)
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Глубокий анализ ИИ {data.totalAnalyzed} комментариев
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
              ? `Доступно через ${getCooldownTimeRemaining()!.hours}ч ${getCooldownTimeRemaining()!.minutes}м`
              : "Обновить анализ"}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* SENTIMENT */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Эмоциональный профиль аудитории</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">{positivePercent}%</div>
              <div className="text-xs mt-1">Позитивные ({sentiment.positive})</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-600">{neutralPercent}%</div>
              <div className="text-xs mt-1">Нейтральные ({sentiment.neutral})</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600">{negativePercent}%</div>
              <div className="text-xs mt-1">Негативные ({sentiment.negative})</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* EMOTIONAL OVERVIEW (v2.1) */}
      {data.emotionalOverview && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Heart className="h-5 w-5 text-pink-600" />
              Эмоциональный обзор
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed">{data.emotionalOverview}</p>
          </CardContent>
        </Card>
      )}

      {/* THEMES */}
      {data.themes?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Популярные темы
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.themes.map((t: string, i: number) => (
                <li key={i} className="flex items-start gap-2">
                  ▪ <span>{t}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* KEY TOPICS (v2.1) */}
      {data.keyTopics?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Ключевые темы
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.keyTopics.map((topic: any, i: number) => (
                <div key={i} className="p-3 border rounded-lg">
                  <h4 className="font-semibold text-sm">{topic.name}</h4>
                  <p className="text-sm text-muted-foreground mt-1">{topic.description}</p>
                  {topic.examples?.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-2">Примеры: {topic.examples.slice(0, 3).join(", ")}</p>
                  )}
                  {topic.motive && (
                    <p className="text-xs text-muted-foreground mt-1">Мотив: {topic.motive}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pain Points */}
      {data.painPoints?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              Болевые точки аудитории
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.painPoints.map((p: string, i: number) => (
                <li key={i} className="flex items-start gap-2">
                  ⚠ <span>{p}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* POSITIVE TRIGGERS (v2.1) */}
      {data.positiveTriggers?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Heart className="h-5 w-5 text-green-600" />
              Позитивные триггеры
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.positiveTriggers.map((trigger: any, i: number) => (
                <div key={i} className="p-3 bg-green-50 rounded-lg">
                  <h4 className="font-semibold text-sm text-green-900">{trigger.trigger}</h4>
                  <p className="text-sm text-green-800 mt-1">Похвала: {trigger.what_praised}</p>
                  <p className="text-xs text-green-700 mt-1">{trigger.why_resonates}</p>
                  {trigger.video_types && (
                    <p className="text-xs text-muted-foreground mt-1">Типы видео: {trigger.video_types}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* REQUESTS */}
      {data.requests?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-purple-600" />
              Пожелания аудитории
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.requests.map((r: string, i: number) => (
                <li key={i}>💬 {r}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* NEGATIVE TRIGGERS (v2.1) */}
      {data.negativeTriggers?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              Негативные триггеры
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.negativeTriggers.map((trigger: any, i: number) => (
                <div key={i} className="p-3 bg-red-50 rounded-lg">
                  <h4 className="font-semibold text-sm text-red-900">{trigger.trigger}</h4>
                  <p className="text-sm text-red-800 mt-1">Причина: {trigger.what_causes_negativity}</p>
                  <p className="text-xs text-red-700 mt-1">{trigger.why_harmful}</p>
                  {trigger.fix && (
                    <p className="text-xs text-blue-700 mt-1">Решение: {trigger.fix}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* PRAISES */}
      {data.praises?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Heart className="h-5 w-5 text-pink-600" />
              Что им нравится
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.praises.map((p: string, i: number) => (
                <li key={i}>♥ {p}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* FAQ (v2.1) */}
      {data.faq?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-indigo-600" />
              Частые вопросы
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.faq.map((item: any, i: number) => (
                <div key={i} className="p-3 border-l-4 border-indigo-300">
                  <h4 className="font-semibold text-sm text-indigo-900">{item.question}</h4>
                  {item.why_appears && (
                    <p className="text-xs text-muted-foreground mt-1">Почему: {item.why_appears}</p>
                  )}
                  {item.action && (
                    <p className="text-xs text-blue-700 mt-1">Действие: {item.action}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* SEGMENTS (v2.1) */}
      {data.audienceSegments?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-cyan-600" />
              Сегменты аудитории
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.audienceSegments.map((segment: any, i: number) => (
                <div key={i} className="p-4 border rounded-lg bg-cyan-50">
                  <h4 className="font-semibold text-cyan-900">{segment.segment}</h4>
                  <p className="text-sm text-muted-foreground mt-2">{segment.description}</p>

                  <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                    {segment.writes_about && (
                      <div>
                        <span className="font-semibold text-cyan-800">Пишут о:</span>
                        <p className="text-muted-foreground">{segment.writes_about}</p>
                      </div>
                    )}
                    {segment.understanding_level && (
                      <div>
                        <span className="font-semibold text-cyan-800">Понимание:</span>
                        <p className="text-muted-foreground">{segment.understanding_level}</p>
                      </div>
                    )}
                    {segment.motives && (
                      <div>
                        <span className="font-semibold text-cyan-800">Мотивы:</span>
                        <p className="text-muted-foreground">{segment.motives}</p>
                      </div>
                    )}
                    {segment.suitable_content && (
                      <div>
                        <span className="font-semibold text-cyan-800">Подходящий контент:</span>
                        <p className="text-muted-foreground">{segment.suitable_content}</p>
                      </div>
                    )}
                  </div>

                  {segment.growth_strategy && (
                    <div className="mt-3 p-2 bg-blue-100 rounded">
                      <p className="text-xs font-semibold text-blue-900">Стратегия роста:</p>
                      <p className="text-xs text-blue-800">{segment.growth_strategy}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* HIDDEN PATTERNS */}
      {data.hiddenPatterns?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Скрытые паттерны</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.hiddenPatterns.map((p: string, i: number) => (
                <li key={i}>→ {p}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* BEHAVIORAL INSIGHTS (v2.1) */}
      {data.behavioralInsights?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-600" />
              Поведенческие инсайты
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.behavioralInsights.map((insight: string, i: number) => (
                <li key={i} className="flex items-start gap-2">
                  🧠 <span className="text-sm">{insight}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* ACTIONABLE IDEAS */}
      {data.actionableIdeas?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Практические рекомендации</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {data.actionableIdeas.map((a: string, i: number) => (
                <li key={i}>💡 {a}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* MISSING ELEMENTS (v2.1) */}
      {data.missingElements?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              Отсутствующие элементы
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.missingElements.map((element: string, i: number) => (
                <li key={i} className="flex items-start gap-2">
                  ✋ <span className="text-sm">{element}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* GROWTH OPPORTUNITIES (v2.1) */}
      {data.growthOpportunities?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
              Возможности роста
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.growthOpportunities.map((opp: any, i: number) => (
                <div key={i} className="p-3 border-l-4 border-emerald-400 bg-emerald-50">
                  <h4 className="font-semibold text-sm text-emerald-900">{opp.opportunity}</h4>
                  {opp.based_on && (
                    <p className="text-xs text-muted-foreground mt-1">На основе: {opp.based_on}</p>
                  )}
                  {opp.how_use && (
                    <p className="text-xs text-emerald-800 mt-1">Как использовать: {opp.how_use}</p>
                  )}
                  {opp.expected_effect && (
                    <p className="text-xs text-emerald-700 mt-1">Ожидаемый эффект: {opp.expected_effect}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* TOP QUOTES */}
      {data.topQuotes?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Лучшие цитаты из комментариев</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.topQuotes.slice(0, 8).map((quote: string, i: number) => (
                <blockquote key={i} className="pl-4 border-l-2 text-sm italic">
                  "{quote}"
                </blockquote>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* CHECKLIST (v2.1) - 8 Fixed Items */}
      {data.checklist?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-600" />
              Чек-лист действий
            </CardTitle>
            <CardDescription>8 ключевых действий для улучшения контента на основе отзывов аудитории</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {data.checklist.slice(0, 8).map((item: string, i: number) => (
                <div key={i} className="flex items-start gap-3 p-2 border rounded">
                  <span className="text-lg font-bold text-indigo-600 min-w-6">{i + 1}.</span>
                  <span className="text-sm leading-relaxed">{item || `Действие ${i + 1}`}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </CardContent>
  );
}
