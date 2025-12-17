"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DeepCommentAnalysis } from "@/components/channel/DeepCommentAnalysis";
import { AnalysisLoadingState } from "@/components/ui/AnalysisLoadingState";
import { useAnalysisProgressStore } from "@/store/analysisProgressStore";

interface DeepCommentAnalysisSectionProps {
  competitorId: number;
  deepAnalysisData: any;
  channelId: string;
  /** Есть ли комментарии для анализа */
  hasRequiredData?: boolean;
}

export function DeepCommentAnalysisSection({
  competitorId,
  deepAnalysisData,
  channelId,
  hasRequiredData = false,
}: DeepCommentAnalysisSectionProps) {
  const router = useRouter();
  const { start, finish, isGenerating } = useAnalysisProgressStore();
  const isGeneratingDeep = isGenerating(channelId, 'deep');

  const handleGetDeepAnalysis = async () => {
    if (!competitorId) {
      console.error("competitorId not provided");
      return;
    }

    start(channelId, 'deep');
    try {
      // Шаг 1: Генерируем глубокий анализ комментариев
      const syncRes = await fetch(`/api/channel/${competitorId}/comments/ai`, {
        method: "POST",
        credentials: "include",
      });

      if (!syncRes.ok) {
        const syncError = await syncRes.json();
        console.error("Failed to generate deep analysis:", syncError);
        return;
      }

      // Шаг 2: Отмечаем глубокий анализ как показанный
      const showRes = await fetch(`/api/channel/${competitorId}/deep-comments/show`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!showRes.ok) {
        const showError = await showRes.json();
        console.error("Failed to show deep comments:", showError);
        return;
      }

      // Шаг 3: Обновляем UI после успешного завершения обеих операций
      router.refresh();
    } catch (err) {
      console.error("Ошибка при получении глубокого анализа комментариев:", err);
    } finally {
      finish(channelId, 'deep');
    }
  };

  return (
    <CardContent className="p-6">
      <>
        {!hasRequiredData ? (
          /* Нет комментариев - показываем оповещение */
          <div className="flex flex-col items-center justify-center py-12">
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20 p-6 max-w-sm text-center">
              <p className="text-sm text-amber-900 dark:text-amber-100 mb-2">
                На этом канале нет комментариев
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Глубокий анализ требует наличия комментариев на видео
              </p>
            </div>
          </div>
        ) : isGeneratingDeep ? (
          /* Идёт генерация - показываем Loading State */
          <AnalysisLoadingState
            title="Анализ комментариев..."
            subtitle="Это может занять 15-25 секунд"
          />
        ) : !deepAnalysisData ? (
          /* Данные не загружены - показываем кнопку */
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <div className="flex flex-col items-center justify-center gap-4">
              <p className="text-center">
                Нажмите кнопку ниже, чтобы получить глубокий анализ комментариев.
              </p>
              <Button
                onClick={() => handleGetDeepAnalysis()}
                variant="default"
                size="sm"
              >
                Глубокий анализ комментариев
              </Button>
            </div>
          </div>
        ) : (
          /* Данные загружены - показываем анализ */
          <DeepCommentAnalysis
            channelId={channelId}
            competitorId={competitorId}
            initialData={deepAnalysisData}
            hasRequiredData={hasRequiredData}
          />
        )}
      </>
    </CardContent>
  );
}
