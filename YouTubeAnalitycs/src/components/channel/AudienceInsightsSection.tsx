"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AudienceInsights } from "@/components/channel/AudienceInsights";
import { useAnalysisProgressStore } from "@/store/analysisProgressStore";

interface AudienceInsightsSectionProps {
  competitorId: number;
  audienceData: any;
  channelId: string;
  /** Есть ли видео для анализа */
  hasRequiredData?: boolean;
}

export function AudienceInsightsSection({
  competitorId,
  audienceData,
  channelId,
  hasRequiredData = false,
}: AudienceInsightsSectionProps) {
  const router = useRouter();
  const { start, finish, isGenerating } = useAnalysisProgressStore();
  const isGeneratingAudience = isGenerating(channelId, 'audience');

  const handleGetAudience = async () => {
    if (!competitorId) {
      console.error("competitorId not provided");
      return;
    }

    start(channelId, 'audience');
    try {
      // Шаг 1: Синхронизируем аудиторию (генерируем анализ)
      const syncRes = await fetch(`/api/channel/${competitorId}/audience`, {
        method: "POST",
      });

      if (!syncRes.ok) {
        const syncError = await syncRes.json();
        console.error("Failed to sync audience:", syncError);
        return;
      }

      // Шаг 2: Отмечаем аудиторию как показанную
      const showRes = await fetch(`/api/channel/${competitorId}/audience/show`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!showRes.ok) {
        const showError = await showRes.json();
        console.error("Failed to show audience:", showError);
        return;
      }

      // Шаг 3: Обновляем UI после успешного завершения обеих операций
      router.refresh();
    } catch (err) {
      console.error("Ошибка при получении аудитории:", err);
    } finally {
      finish(channelId, 'audience');
    }
  };

  return (
    <CardContent className="p-6">
      <>
        {!audienceData ? (
          /* Данные не загружены - показываем кнопку */
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <div className="flex flex-col items-center justify-center gap-4">
              <p className="text-center">
                Нажмите кнопку ниже, чтобы получить анализ аудитории.
              </p>
              <Button
                onClick={() => handleGetAudience()}
                variant="default"
                size="sm"
                disabled={isGeneratingAudience}
              >
                {isGeneratingAudience ? "Анализируем..." : "Получить аудиторию"}
              </Button>
            </div>
          </div>
        ) : (
          /* Данные загружены - показываем анализ */
          <AudienceInsights
            competitorId={competitorId}
            channelId={channelId}
            initialData={audienceData}
            hasRequiredData={hasRequiredData}
          />
        )}
      </>
    </CardContent>
  );
}
