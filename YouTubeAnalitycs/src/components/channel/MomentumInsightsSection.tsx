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
        const syncError = await syncRes.json();
        const errorMessage = syncError?.error || "Failed to sync momentum";
        console.error("[MomentumInsightsSection] Sync error:", syncError);
        throw new Error(errorMessage);
      }

      // Шаг 2: Отмечаем momentum как показанный
      const showRes = await fetch(`/api/channel/${competitorId}/momentum/show`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!showRes.ok) {
        const showError = await showRes.json();
        const errorMessage = showError?.error || "Failed to show momentum";
        console.error("[MomentumInsightsSection] Show error:", showError);
        throw new Error(errorMessage);
      }

      // Шаг 3: Обновляем UI после успешного завершения обеих операций
      router.refresh();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to generate momentum analysis";
      console.error("[MomentumInsightsSection] Error:", err);
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
