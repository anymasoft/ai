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

  const handleGetMomentum = async () => {
    if (!competitorId) {
      console.error("competitorId not provided");
      return;
    }

    start(channelId, 'momentum');
    setError(null);
    try {
      // Шаг 1: Генерируем momentum анализ
      const syncRes = await fetch(`/api/channel/${competitorId}/momentum`, {
        method: "POST",
      });

      if (!syncRes.ok) {
        const syncText = await syncRes.text().catch(() => "");
        throw new Error(
          syncText || `Momentum sync failed with status ${syncRes.status}`
        );
      }

      // Шаг 2: Отмечаем momentum как показанный
      const showRes = await fetch(`/api/channel/${competitorId}/momentum/show`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!showRes.ok) {
        const showText = await showRes.text().catch(() => "");
        throw new Error(
          showText || `Momentum show failed with status ${showRes.status}`
        );
      }

      // Шаг 3: Обновляем UI после успешного завершения обеих операций
      router.refresh();
    } catch (err) {
      const error = normalizeError(err);

      console.error(
        "[MomentumInsightsSection] FINAL ERROR:",
        error.message
      );
      console.error(
        "[MomentumInsightsSection] Stack:",
        error.stack
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
            title="Generating momentum analysis..."
            subtitle="This may take 15-25 seconds"
          />
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
