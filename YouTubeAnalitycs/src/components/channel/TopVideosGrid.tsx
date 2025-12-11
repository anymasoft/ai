"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { formatPublishedDate } from "@/lib/date-formatting";
import type { UserPlan } from "@/config/limits";

interface VideoData {
  id: number;
  channelId: string;
  videoId: string;
  title: string;
  thumbnailUrl: string | null;
  viewCountInt: number;
  likeCountInt: number;
  commentCountInt: number;
  publishDate: string | null;
  durationSeconds?: number | null;
  fetchedAt: number;
  updatedAt: number;
}

interface TopVideosGridProps {
  /** Массив видео из БД (TOP-12 ONLY) */
  videos: VideoData[];
  /** YouTube Channel ID (строка) */
  channelId: string;
  /** План пользователя */
  userPlan?: UserPlan;
}

/**
 * Форматирует числа для читаемости (1000000 => 1.2M)
 */
function formatViews(views: number | undefined | null): string {
  if (views === undefined || views === null || typeof views !== "number" || !Number.isFinite(views)) {
    return "0";
  }
  if (views >= 1000000) {
    return `${(views / 1000000).toFixed(1)}M`;
  }
  if (views >= 1000) {
    return `${(views / 1000).toFixed(1)}K`;
  }
  return views.toString();
}

/**
 * Новая архитектура TOP-12 ONLY:
 * - Всегда получает готовый список видео из БД через пропсы
 * - Нет кнопки "Получить топ-видео" (замена синхронизирована при добавлении канала)
 * - Кнопка "Обновить топ-видео" для ручного refresh
 * - Никакой зависимости от user_channel_state флагов
 */
export function TopVideosGrid({ videos, channelId, userPlan = "free" }: TopVideosGridProps) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);

  if (!channelId) {
    console.error("[TopVideosGrid] channelId is undefined, component cannot render");
    return null;
  }

  if (process.env.NODE_ENV === "development") {
    console.log("[TopVideosGrid] TOP-12 ONLY режим", {
      channelId,
      videosCount: videos.length,
    });
  }

  // Обновляет (переполняет кеш) и перезагружает топ-видео
  const handleRefreshVideos = async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch(`/api/channel/${channelId}/videos/sync`, {
        method: "POST",
        cache: "no-store",
      });

      if (!res.ok) {
        console.error("[TopVideosGrid] Ошибка обновления: HTTP " + res.status);
        return;
      }

      const data = await res.json();
      console.log("[TopVideosGrid] Видео обновлены успешно", {
        videosCount: data.videos?.length,
      });

      // Обновляем страницу для получения свежих данных из БД
      router.refresh();
    } catch (err) {
      console.error("[TopVideosGrid] Ошибка при обновлении:", err instanceof Error ? err.message : err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Если видео нет → показываем сообщение
  if (videos.length === 0) {
    return (
      <CardContent className="p-6">
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <p className="text-center mb-4">
            Видео ещё синхронизируются. Попробуйте обновить страницу через несколько секунд.
          </p>
          <Button
            onClick={handleRefreshVideos}
            disabled={isRefreshing}
            variant="outline"
          >
            {isRefreshing ? "Обновляем..." : "Обновить"}
          </Button>
        </div>
      </CardContent>
    );
  }

  // Видео есть → показываем грид TOP-12
  const sortedVideos = [...videos].sort((a, b) => b.viewCountInt - a.viewCountInt);

  return (
    <CardContent className="p-6">
      <div className="space-y-4">
        {/* Кнопка обновления TOP-12 видео */}
        <div className="flex justify-end">
          <Button
            onClick={handleRefreshVideos}
            disabled={isRefreshing}
            size="sm"
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "Обновляем..." : "Обновить топ-видео"}
          </Button>
        </div>

        {/* Грид видео (TOP-12 ONLY) */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {sortedVideos.map((video) => (
            <Card
              key={video.videoId}
              className="group overflow-hidden border border-border/50 rounded-lg shadow-sm hover:shadow-md transition-all duration-150"
            >
              <CardContent className="p-0">
                <a
                  href={`https://www.youtube.com/watch?v=${video.videoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  {video.thumbnailUrl ? (
                    <img
                      src={video.thumbnailUrl}
                      alt={video.title}
                      className="w-full aspect-video object-cover"
                    />
                  ) : (
                    <div className="w-full aspect-video bg-muted flex items-center justify-center text-sm text-muted-foreground">
                      Нет превью
                    </div>
                  )}
                </a>

                <div className="p-3 space-y-2">
                  <h3 className="font-medium text-xs leading-tight line-clamp-2 text-foreground">
                    {video.title}
                  </h3>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="font-medium">
                      {formatViews(video.viewCountInt)} просмотров
                    </span>
                    {video.publishDate && (
                      <span>{formatPublishedDate(video.publishDate, "ru")}</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </CardContent>
  );
}
