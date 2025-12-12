"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MomentumInsights } from "@/components/channel/MomentumInsights";
import { useAnalysisProgressStore } from "@/store/analysisProgressStore";

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

  const handleGetMomentum = async () => {
    if (!competitorId) {
      console.error("competitorId not provided");
      return;
    }

    start(channelId, 'momentum');
    try {
      // Шаг 1: Генерируем momentum анализ
      const syncRes = await fetch(`/api/channel/${competitorId}/momentum`, {
        method: "POST",
      });

      if (!syncRes.ok) {
        const syncError = await syncRes.json();
        console.error("Failed to sync momentum:", syncError);
        return;
      }

      // Шаг 2: Отмечаем momentum как показанный
      const showRes = await fetch(`/api/channel/${competitorId}/momentum/show`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!showRes.ok) {
        const showError = await showRes.json();
        console.error("Failed to show momentum:", showError);
        return;
      }

      // Шаг 3: Обновляем UI после успешного завершения обеих операций
      router.refresh();
    } catch (err) {
      console.error("Ошибка при получении momentum:", err);
    } finally {
      finish(channelId, 'momentum');
    }
  };

  return (
    <CardContent className="p-6">
      <>
        {!momentumData ? (
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
                disabled={isGeneratingMomentum}
              >
                {isGeneratingMomentum ? "Анализируем..." : "Получить Momentum"}
              </Button>
            </div>
          </div>
        ) : (
          /* Данные загружены - показываем анализ */
          <MomentumInsights
            channelId={channelId}
            competitorId={competitorId}
            initialData={momentumData}
            hasRequiredData={hasRequiredData}
          />
        )}
      </>
    </CardContent>
  );
}
