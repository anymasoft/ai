"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ContentIntelligenceBlock } from "@/components/channel/ContentIntelligenceBlock";

interface ContentInsightsSectionProps {
  contentData: any;
  channelId?: string;
  /** Есть ли видео для анализа */
  hasRequiredData?: boolean;
}

export function ContentInsightsSection({
  contentData,
  channelId,
  hasRequiredData = false,
}: ContentInsightsSectionProps) {
  const router = useRouter();
  const [loadingContent, setLoadingContent] = useState(false);

  const handleGetContent = async () => {
    if (!channelId) {
      console.error("channelId not provided");
      return;
    }

    setLoadingContent(true);
    try {
      // Шаг 1: Генерируем анализ контент-аналитики
      const syncRes = await fetch(`/api/channel/${channelId}/content-intelligence`, {
        method: "POST",
      });

      if (!syncRes.ok) {
        const syncError = await syncRes.json();
        console.error("Failed to generate content intelligence:", syncError);
        return;
      }

      // Шаг 2: Отмечаем контент-аналитику как показанную
      const showRes = await fetch(`/api/channel/${channelId}/content/show`, {
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
      setLoadingContent(false);
    }
  };

  return (
    <CardContent className="p-6">
      <>
        {!contentData ? (
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
                disabled={loadingContent}
              >
                {loadingContent ? "Анализируем..." : "Получить Content Intelligence"}
              </Button>
            </div>
          </div>
        ) : (
          /* Данные загружены - показываем анализ */
          <ContentIntelligenceBlock
            channelId={channelId}
            initialData={contentData}
            hasRequiredData={hasRequiredData}
          />
        )}
      </>
    </CardContent>
  );
}
