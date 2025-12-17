"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RefreshCw } from "lucide-react";
import { formatPublishedDate } from "@/lib/date-formatting";
import { useRefreshCooldown } from "@/hooks/use-refresh-cooldown";
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
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [videoList, setVideoList] = useState(videos);

  // Hook для управления cooldown таймером обновления видео
  const refreshCooldown = useRefreshCooldown({
    userPlan,
    cooldownMs: 60000,
  });

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

  // Обновляет дату публикации одного видео
  const refreshDate = async (e: React.MouseEvent, videoId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setRefreshingId(videoId);
    try {
      const res = await fetch(`/api/video/${videoId}/refresh-date`, { method: "POST" });
      const result = await res.json();
      if (result.success && result.publishDate) {
        setVideoList(prev => prev.map(v =>
          v.videoId === videoId ? { ...v, publishDate: result.publishDate } : v
        ));
      }
    } catch (err) {
      console.error("[TopVideosGrid] Ошибка обновления даты:", err);
    } finally {
      setRefreshingId(null);
    }
  };

  // Обновляет (переполняет кеш) и перезагружает топ-видео
  const handleRefreshVideos = async () => {
    // Для free-плана запрос не делаем
    if (refreshCooldown.isFreePlan) {
      return;
    }

    // Запускаем cooldown (даже если платный пользователь)
    refreshCooldown.startCooldown();
    setIsRefreshing(true);

    try {
      const res = await fetch(`/api/channel/${competitorId}/videos/sync`, {
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
      // setIsRefreshing сбросится автоматически когда cooldown закончится
      // но также сбросим здесь если был быстрый ответ
      if (!refreshCooldown.isOnCooldown) {
        setIsRefreshing(false);
      }
    }
  };

  // Если видео нет → показываем сообщение
  if (videos.length === 0) {
    const isButtonDisabled = refreshCooldown.isFreePlan || refreshCooldown.isOnCooldown || isRefreshing;

    return (
      <CardContent className="p-6">
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <p className="text-center mb-4">
            Видео ещё синхронизируются. Попробуйте обновить страницу через несколько секунд.
          </p>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handleRefreshVideos}
                disabled={isButtonDisabled}
                variant="outline"
                className={refreshCooldown.isFreePlan ? "cursor-not-allowed" : "cursor-pointer"}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${(isRefreshing || refreshCooldown.isOnCooldown) ? "animate-spin" : ""}`} />
                {refreshCooldown.isOnCooldown ? `Обновляем (${refreshCooldown.secondsRemaining}с)...` : isRefreshing ? "Обновляем..." : "Обновить"}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {refreshCooldown.getTooltipText('Обновить видео')}
            </TooltipContent>
          </Tooltip>
        </div>
      </CardContent>
    );
  }

  // Видео есть → показываем грид TOP-12
  const sortedVideos = [...videoList].sort((a, b) => b.viewCountInt - a.viewCountInt);

  return (
    <CardContent className="p-6">
      <div className="space-y-4">
        {/* Кнопка обновления TOP-12 видео */}
        <div className="flex justify-end">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handleRefreshVideos}
                disabled={refreshCooldown.isFreePlan || refreshCooldown.isOnCooldown || isRefreshing}
                size="icon"
                variant="outline"
                className={refreshCooldown.isFreePlan ? "cursor-not-allowed" : "cursor-pointer"}
              >
                <RefreshCw className={`h-4 w-4 ${(isRefreshing || refreshCooldown.isOnCooldown) ? "animate-spin" : ""}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {refreshCooldown.getTooltipText('Обновить топ-видео')}
            </TooltipContent>
          </Tooltip>
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
                    {video.publishDate ? (
                      <span>{formatPublishedDate(video.publishDate, "ru")}</span>
                    ) : (
                      <button
                        onClick={(e) => refreshDate(e, video.videoId)}
                        disabled={refreshingId === video.videoId}
                        title="Обновить дату публикации"
                        className="hover:text-foreground disabled:opacity-50"
                      >
                        <RefreshCw className={`h-3 w-3 ${refreshingId === video.videoId ? "animate-spin" : ""}`} />
                      </button>
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
