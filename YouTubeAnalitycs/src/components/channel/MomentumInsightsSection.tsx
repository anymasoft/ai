"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MomentumInsights } from "@/components/channel/MomentumInsights";
import { useAnalysisProgressStore } from "@/store/analysisProgressStore";
import { AnalysisLoadingState } from "@/components/ui/AnalysisLoadingState";

interface MomentumInsightsSectionProps {
  competitorId: number;
  momentumData: any;
  channelId: string;
  /** Есть ли видео для анализа */
  hasRequiredData?: boolean;
}

/**
 * Нормализует любую ошибку в Error объект
 * НИКОГДА не возвращает пустой объект или неизвестный тип
 */
function normalizeError(e: unknown): Error {
  if (e instanceof Error) {
    return e;
  }

  if (typeof e === "string") {
    return new Error(e);
  }

  if (e && typeof e === "object") {
    try {
      return new Error(`Momentum error: ${JSON.stringify(e)}`);
    } catch {
      return new Error(`Momentum error: [non-serializable object]`);
    }
  }

  return new Error("Unknown momentum error");
}

/**
 * Читает ошибку из API ответа
 * Попробует json(), если упадёт — читает text()
 */
async function readApiError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (data?.error) return String(data.error);
    if (data?.message) return String(data.message);
    if (data?.ok === false && data?.error) return String(data.error);
    return `API error with status ${res.status}`;
  } catch {
    try {
      const text = await res.text();
      return text || `API error with status ${res.status}`;
    } catch {
      return `API error with status ${res.status}`;
    }
  }
}

export function MomentumInsightsSection({
  competitorId,
  momentumData,
  channelId,
  hasRequiredData = false,
}: MomentumInsightsSectionProps) {
  const router = useRouter();
  const { start, finish, isGenerating } = useAnalysisProgressStore();
  const isGeneratingMomentum = isGenerating(channelId, 'momentum');
  const [error, setError] = useState<string | null>(null);
  const [emptyReason, setEmptyReason] = useState<string | null>(null);

  const handleGetMomentum = async () => {
    if (!competitorId) {
      console.error("competitorId not provided");
      return;
    }

    start(channelId, 'momentum');
    setError(null);
    setEmptyReason(null);
    try {
      // Шаг 1: Генерируем momentum анализ
      const syncRes = await fetch(`/api/channel/${competitorId}/momentum`, {
        method: "POST",
      });

      if (!syncRes.ok) {
        const errorMsg = await readApiError(syncRes);

        // Обработка empty-state кейсов как нормального результата, не ошибки
        if (errorMsg.includes("No быстрый рост videos found") ||
            errorMsg.includes("No videos with valid publication dates") ||
            errorMsg.includes("Sync Top Videos first")) {
          console.info(`[MomentumInsightsSection] Empty state: ${errorMsg}`);
          setEmptyReason(errorMsg);
          return;
        }

        throw new Error(errorMsg);
      }

      // Шаг 2: Отмечаем momentum как показанный
      const showRes = await fetch(`/api/channel/${competitorId}/momentum/show`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!showRes.ok) {
        const showErrorMsg = await readApiError(showRes);
        throw new Error(showErrorMsg);
      }

      // Шаг 3: Обновляем UI после успешного завершения обеих операций
      router.refresh();
    } catch (err) {
      const error = normalizeError(err);

      console.error(
        "[MomentumInsightsSection] Error:",
        error.message
      );

      setError(error.message);
    } finally {
      finish(channelId, 'momentum');
    }
  };

  return (
    <CardContent className="p-6">
      <>
        {isGeneratingMomentum ? (
          /* Генерация в процессе - показываем лоадер */
          <AnalysisLoadingState
            title="Анализируем рост видео..."
            subtitle="Это может занять 15-25 секунд"
          />
        ) : emptyReason ? (
          /* Данные есть но они пусты - показываем empty state */
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <div className="flex flex-col items-center justify-center gap-4">
              <p className="text-center text-sm">
                {emptyReason === "Sync Top Videos first"
                  ? "Сначала синхронизируйте видео"
                  : emptyReason.includes("No быстрый рост")
                    ? "На этом канале нет видео с высоким momentum"
                    : "Недостаточно данных для анализа momentum"}
              </p>
              <Button
                onClick={() => handleGetMomentum()}
                variant="default"
                size="sm"
              >
                Повторить
              </Button>
            </div>
          </div>
        ) : !momentumData ? (
          /* Данные не загружены - показываем кнопку */
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <div className="flex flex-col items-center justify-center gap-4">
              <p className="text-center">
                Нажмите кнопку ниже, чтобы получить анализ momentum.
              </p>
              <Button
                onClick={() => handleGetMomentum()}
                variant="default"
                size="sm"
              >
                Получить Momentum
              </Button>
            </div>
          </div>
        ) : (
          /* Данные загружены - показываем анализ */
          <div>
            {error && (
              <div className="mb-4 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}
            <MomentumInsights
              channelId={channelId}
              competitorId={competitorId}
              initialData={momentumData}
              hasRequiredData={hasRequiredData}
            />
          </div>
        )}
      </>
    </CardContent>
  );
}
