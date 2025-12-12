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
        let syncError;
        try {
          syncError = await syncRes.json();
        } catch (parseErr) {
          const parseErrMsg = parseErr instanceof Error ? parseErr.message : String(parseErr);
          throw new Error(`[MomentumInsightsSection] Failed to parse sync response: ${parseErrMsg}. Status: ${syncRes.status}`);
        }

        const errorMessage =
          (syncError && typeof syncError === 'object' && syncError.error)
            ? String(syncError.error)
            : syncError
              ? JSON.stringify(syncError)
              : `Momentum sync failed with status ${syncRes.status}`;

        console.error("[MomentumInsightsSection] Sync error response:", {
          status: syncRes.status,
          body: syncError,
          message: errorMessage,
        });
        throw new Error(errorMessage);
      }

      // Шаг 2: Отмечаем momentum как показанный
      const showRes = await fetch(`/api/channel/${competitorId}/momentum/show`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!showRes.ok) {
        let showError;
        try {
          showError = await showRes.json();
        } catch (parseErr) {
          const parseErrMsg = parseErr instanceof Error ? parseErr.message : String(parseErr);
          throw new Error(`[MomentumInsightsSection] Failed to parse show response: ${parseErrMsg}. Status: ${showRes.status}`);
        }

        const errorMessage =
          (showError && typeof showError === 'object' && showError.error)
            ? String(showError.error)
            : showError
              ? JSON.stringify(showError)
              : `Momentum show failed with status ${showRes.status}`;

        console.error("[MomentumInsightsSection] Show error response:", {
          status: showRes.status,
          body: showError,
          message: errorMessage,
        });
        throw new Error(errorMessage);
      }

      // Шаг 3: Обновляем UI после успешного завершения обеих операций
      router.refresh();
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : typeof err === 'string'
            ? err
            : typeof err === 'object' && err !== null && 'error' in err
              ? String((err as any).error)
              : JSON.stringify(err) || 'Failed to generate momentum analysis';

      console.error("[MomentumInsightsSection] Catch block error:", {
        type: err?.constructor?.name,
        message: errorMessage,
        original: err,
      });
      setError(errorMessage);
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
