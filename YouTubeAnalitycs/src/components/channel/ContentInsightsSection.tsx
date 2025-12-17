"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ContentIntelligenceBlock } from "@/components/channel/ContentIntelligenceBlock";
import { useAnalysisProgressStore } from "@/store/analysisProgressStore";
import { AnalysisLoadingState } from "@/components/ui/AnalysisLoadingState";

interface ContentInsightsSectionProps {
  competitorId: number;
  contentData: any;
  channelId: string;
  /** Есть ли видео для анализа */
  hasRequiredData?: boolean;
}

export function ContentInsightsSection({
  competitorId,
  contentData,
  channelId,
  hasRequiredData = false,
}: ContentInsightsSectionProps) {
  const router = useRouter();
  const { start, finish, isGenerating } = useAnalysisProgressStore();
  const isGeneratingContent = isGenerating(channelId, 'content');

  const handleGetContent = async () => {
    if (!competitorId) {
      console.error("competitorId not provided");
      return;
    }

    start(channelId, 'content');
    try {
      // Шаг 1: Генерируем анализ контент-аналитики
      const syncRes = await fetch(`/api/channel/${competitorId}/content-intelligence`, {
        method: "POST",
      });

      if (!syncRes.ok) {
        const syncError = await syncRes.json();
        console.error("Failed to generate content intelligence:", syncError);
        return;
      }

      // Шаг 2: Отмечаем контент-аналитику как показанную
      const showRes = await fetch(`/api/channel/${competitorId}/content/show`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!showRes.ok) {
        const showError = await showRes.json();
        console.error("Failed to show content:", showError);
        return;
      }

      // Шаг 3: Обновляем UI после успешного завершения обеих операций
      router.refresh();
    } catch (err) {
      console.error("Ошибка при получении контент-аналитики:", err);
    } finally {
      finish(channelId, 'content');
    }
  };

  return (
    <CardContent className="p-6">
      <>
        {isGeneratingContent ? (
          /* Генерация в процессе - показываем лоадер */
          <AnalysisLoadingState
            title="Создание анализа контента..."
            subtitle="Это может занять 15-25 секунд"
          />
        ) : !contentData ? (
          /* Данные не загружены - показываем кнопку */
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <div className="flex flex-col items-center justify-center gap-4">
              <p className="text-center">
                Нажмите кнопку ниже, чтобы получить анализ контент-аналитики.
              </p>
              <Button
                onClick={() => handleGetContent()}
                variant="default"
                size="sm"
              >
                Получить Content Intelligence
              </Button>
            </div>
          </div>
        ) : (
          /* Данные загружены - показываем анализ */
          <ContentIntelligenceBlock
            channelId={channelId}
            competitorId={competitorId}
            initialData={contentData}
            hasRequiredData={hasRequiredData}
          />
        )}
      </>
    </CardContent>
  );
}
