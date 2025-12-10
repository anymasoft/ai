"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AudienceInsights } from "@/components/channel/AudienceInsights";

interface AudienceInsightsSectionProps {
  audienceData: any;
  channelId?: string;
  /** Нажал ли пользователь "Получить аудиторию" */
  hasShownAudience?: boolean;
  /** Есть ли видео для анализа */
  hasRequiredData?: boolean;
}

export function AudienceInsightsSection({
  audienceData,
  channelId,
  hasShownAudience = false,
  hasRequiredData = false,
}: AudienceInsightsSectionProps) {
  const router = useRouter();
  const [loadingAudience, setLoadingAudience] = useState(false);

  const handleGetAudience = async () => {
    if (!channelId) {
      console.error("channelId not provided");
      return;
    }

    setLoadingAudience(true);
    try {
      // Шаг 1: Синхронизируем аудиторию (генерируем анализ)
      const syncRes = await fetch(`/api/channel/${channelId}/audience`, {
        method: "POST",
      });

      if (!syncRes.ok) {
        const syncError = await syncRes.json();
        console.error("Failed to sync audience:", syncError);
        return;
      }

      // Шаг 2: Отмечаем аудиторию как показанную
      const showRes = await fetch(`/api/channel/${channelId}/audience/show`, {
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
      setLoadingAudience(false);
    }
  };

  return (
    <CardContent className="p-6">
      <>
        {/* STATE 1: Пользователь никогда не нажимал кнопку "Получить аудиторию" */}
        {!hasShownAudience ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <div className="flex flex-col items-center justify-center gap-4">
              <p className="text-center">
                {!hasRequiredData
                  ? "Загрузите видео канала, чтобы получить анализ аудитории."
                  : "Нет данных. Нажмите «Получить аудиторию», чтобы загрузить анализ."}
              </p>
              <Button
                onClick={() => handleGetAudience()}
                variant="default"
                size="sm"
                disabled={loadingAudience || !hasRequiredData}
              >
                {loadingAudience ? "Анализируем..." : "Получить аудиторию"}
              </Button>
            </div>
          </div>
        ) : !audienceData ? (
          /* Пользователь нажимал кнопку, но данные не найдены */
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <p className="text-center">
              Анализ аудитории не найден. Попробуйте получить аудиторию ещё раз.
            </p>
            <Button
              onClick={() => handleGetAudience()}
              variant="outline"
              size="sm"
              className="mt-4"
              disabled={loadingAudience}
            >
              {loadingAudience ? "Анализируем..." : "Получить аудиторию"}
            </Button>
          </div>
        ) : (
          /* STATE 2: Есть данные аудитории */
          <AudienceInsights
            channelId={channelId}
            initialData={audienceData}
            hasRequiredData={hasRequiredData}
          />
        )}
      </>
    </CardContent>
  );
}
