"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DeepCommentAnalysis } from "@/components/channel/DeepCommentAnalysis";

interface DeepCommentAnalysisSectionProps {
  deepAnalysisData: any;
  channelId?: string;
  /** Нажал ли пользователь "Получить Deep Analysis" */
  hasShownDeepComments?: boolean;
  /** Есть ли комментарии для анализа */
  hasRequiredData?: boolean;
}

export function DeepCommentAnalysisSection({
  deepAnalysisData,
  channelId,
  hasShownDeepComments = false,
  hasRequiredData = false,
}: DeepCommentAnalysisSectionProps) {
  const router = useRouter();
  const [loadingDeepAnalysis, setLoadingDeepAnalysis] = useState(false);

  const handleGetDeepAnalysis = async () => {
    if (!channelId) {
      console.error("channelId not provided");
      return;
    }

    setLoadingDeepAnalysis(true);
    try {
      // Шаг 1: Генерируем глубокий анализ комментариев
      const syncRes = await fetch(`/api/channel/${channelId}/comments/ai`, {
        method: "POST",
        credentials: "include",
      });

      if (!syncRes.ok) {
        const syncError = await syncRes.json();
        console.error("Failed to generate deep analysis:", syncError);
        return;
      }

      // Шаг 2: Отмечаем глубокий анализ как показанный
      const showRes = await fetch(`/api/channel/${channelId}/deep-comments/show`, {
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
      setLoadingDeepAnalysis(false);
    }
  };

  return (
    <CardContent className="p-6">
      <>
        {/* STATE 1: Пользователь никогда не нажимал кнопку "Получить Deep Analysis" */}
        {!hasShownDeepComments ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <div className="flex flex-col items-center justify-center gap-4">
              <p className="text-center">
                {!hasRequiredData
                  ? "Загрузите комментарии канала, чтобы получить глубокий анализ."
                  : "Нет данных. Нажмите «Получить Deep Analysis», чтобы загрузить анализ."}
              </p>
              <Button
                onClick={() => handleGetDeepAnalysis()}
                variant="default"
                size="sm"
                disabled={loadingDeepAnalysis || !hasRequiredData}
              >
                {loadingDeepAnalysis ? "Анализируем..." : "Получить Deep Analysis"}
              </Button>
            </div>
          </div>
        ) : !deepAnalysisData ? (
          /* Пользователь нажимал кнопку, но данные не найдены */
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <p className="text-center">
              Глубокий анализ комментариев не найден. Попробуйте получить Deep Analysis ещё раз.
            </p>
            <Button
              onClick={() => handleGetDeepAnalysis()}
              variant="outline"
              size="sm"
              className="mt-4"
              disabled={loadingDeepAnalysis}
            >
              {loadingDeepAnalysis ? "Анализируем..." : "Получить Deep Analysis"}
            </Button>
          </div>
        ) : (
          /* STATE 2: Есть данные глубокого анализа */
          <DeepCommentAnalysis
            channelId={channelId}
            initialData={deepAnalysisData}
            hasRequiredData={hasRequiredData}
          />
        )}
      </>
    </CardContent>
  );
}
