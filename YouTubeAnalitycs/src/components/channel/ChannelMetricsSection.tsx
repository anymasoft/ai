"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChannelGrowthChart } from "@/components/charts/ChannelGrowthChart";

interface ChannelMetric {
  id: number;
  userId: string;
  channelId: string;
  subscriberCount: number;
  videoCount: number;
  viewCount: number;
  date: string;
  fetchedAt: number;
}

interface ChannelMetricsSectionProps {
  metrics: ChannelMetric[];
  channelId?: string;
  /** Нажал ли пользователь "Получить метрики" */
  hasShownMetrics?: boolean;
}

export function ChannelMetricsSection({
  metrics,
  channelId,
  hasShownMetrics = false,
}: ChannelMetricsSectionProps) {
  const router = useRouter();
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  const handleGetMetrics = async () => {
    if (!channelId) {
      console.error("channelId not provided");
      return;
    }

    setLoadingMetrics(true);
    try {
      // Шаг 1: Синхронизируем метрики
      const syncRes = await fetch(`/api/channel/${channelId}/sync`, {
        method: "POST",
      });

      if (!syncRes.ok) {
        const syncError = await syncRes.json();
        console.error("Failed to sync metrics:", syncError);
        return;
      }

      // Шаг 2: Отмечаем метрики как показанные
      const showRes = await fetch(`/api/channel/${channelId}/metrics/show`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!showRes.ok) {
        const showError = await showRes.json();
        console.error("Failed to show metrics:", showError);
        return;
      }

      // Шаг 3: Обновляем UI после успешного завершения обеих операций
      router.refresh();
    } catch (err) {
      console.error("Ошибка при получении метрик:", err);
    } finally {
      setLoadingMetrics(false);
    }
  };

  return (
    <CardContent className="p-6">
      <>
        {/* STATE 1: Пользователь никогда не нажимал кнопку "Получить метрики" */}
        {!hasShownMetrics ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <div className="flex flex-col items-center justify-center gap-4">
              <p className="text-center">
                Нет данных. Нажмите «Получить метрики», чтобы загрузить метрики канала.
              </p>
              <Button
                onClick={() => handleGetMetrics()}
                variant="default"
                size="sm"
                disabled={loadingMetrics}
              >
                {loadingMetrics ? "Загружаем..." : "Получить метрики"}
              </Button>
            </div>
          </div>
        ) : metrics.length === 0 ? (
          /* Пользователь нажимал кнопку, но метрики не найдены */
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <p className="text-center">
              Метрики не найдены. Попробуйте получить метрики ещё раз.
            </p>
            <Button
              onClick={() => handleGetMetrics()}
              variant="outline"
              size="sm"
              className="mt-4"
              disabled={loadingMetrics}
            >
              {loadingMetrics ? "Загружаем..." : "Получить метрики"}
            </Button>
          </div>
        ) : (
          /* STATE 2: Есть метрики */
          <ChannelGrowthChart metrics={metrics} />
        )}
      </>
    </CardContent>
  );
}
