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
  viewCount: number;
  publishDate: string | null;
  fetchedAt: number;
}

interface TopVideosGridProps {
  videos: VideoData[];
  /** YouTube Channel ID (строка) для вызова API */
  channelId: string;
  /** План пользователя для определения лимитов. По умолчанию "free" */
  userPlan?: UserPlan;
}

/**
 * Форматирует числа для читаемости (1000000 => 1.2M)
 * Безопасная функция: обрабатывает undefined/null/NaN
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

export function TopVideosGrid({ videos, channelId, userPlan = "free" }: TopVideosGridProps) {
  const router = useRouter();
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Защита: если channelId не передан, не рендерим компонент
  if (!channelId) {
    console.error("[TopVideosGrid] channelId is undefined, component cannot render");
    return null;
  }

  if (process.env.NODE_ENV === "development") {
    console.log("[TopVideosGrid] TOP-12 ONLY mode", {
      channelId,
      userPlan,
      videosCount: videos.length,
    });
  }

  const refreshDate = async (e: React.MouseEvent, videoId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setRefreshingId(videoId);
    try {
      const res = await fetch(`/api/video/${videoId}/refresh-date`, { method: "POST" });
      if (!res.ok) {
        console.error("Ошибка обновления даты: HTTP " + res.status);
        return;
      }
      const result = await res.json();
      if (result.success && result.publishDate) {
        router.refresh();
      }
    } catch (err) {
      console.error("Ошибка обновления даты:", err instanceof Error ? err.message : err);
    } finally {
      setRefreshingId(null);
    }
  };

  const handleGetTopVideos = async () => {
    if (!channelId) {
      console.error("[TopVideosGrid] channelId is undefined, cannot sync");
      return;
    }

    console.log(`[TopVideosGrid] Получение топ-12 видео для channelId=${channelId}`);
    setIsSyncing(true);
    try {
      // Синхронизируем видео (TOP-12 ONLY)
      const syncRes = await fetch(`/api/channel/${channelId}/videos/sync`, {
        method: "POST",
        cache: "no-store",
      });

      // Проверяем статус ответа перед парсингом JSON
      if (!syncRes.ok) {
        let errorMsg = `HTTP ${syncRes.status}`;
        try {
          const errorData = await syncRes.json();
          if (errorData.error) {
            errorMsg = typeof errorData.error === 'string' ? errorData.error : JSON.stringify(errorData.error);
          }
        } catch (e) {
          // Не смогли распарсить JSON, используем статус код
        }
        console.error(`[TopVideosGrid] Ошибка синхронизации: ${errorMsg}`);
        return;
      }

      const syncData = await syncRes.json();

      // Проверяем успех операции
      if (!syncData.success) {
        const errorMsg = typeof syncData.error === 'string' ? syncData.error : "Unknown sync error";
        console.error(`[TopVideosGrid] Ошибка синхронизации: ${errorMsg}`);
        return;
      }

      console.log(`[TopVideosGrid] Синхронизация успешна:`, {
        videosCount: syncData.videos?.length,
        added: syncData.added,
        updated: syncData.updated,
      });

      // Обновляем UI через router.refresh()
      try {
        router.refresh();
      } catch (err) {
        console.warn("[TopVideosGrid] router.refresh() failed (non-critical):", err);
      }
    } catch (err) {
      console.error(`[TopVideosGrid] Ошибка:`, err instanceof Error ? err.message : err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Debug в dev режиме
  if (process.env.NODE_ENV === "development") {
    console.log(`[TopVideosGrid RENDER] TOP-12 ONLY`, {
      videosLength: videos.length,
    });
  }

  // ВАЖНО:
  // Отображение топ-видео завязано ТОЛЬКО на факте наличия записей в videos[].
  // Если videos.length === 0 — предлагаем "Получить топ-видео".
  // Если videos.length > 0 — всегда показываем грид 12 видео (TOP-12 only).

  if (videos.length === 0) {
    return (
      <CardContent className="p-6">
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <p className="text-center mb-4">
            Видео не найдены. Получить топ-видео?
          </p>
          <Button
            onClick={handleGetTopVideos}
            disabled={isSyncing}
          >
            {isSyncing ? "Загружаем..." : "Получить топ-видео"}
          </Button>
        </div>
      </CardContent>
    );
  }

  // Видео есть — показываем грид (TOP-12 ONLY)
  const sortedVideos = [...videos].sort((a, b) => b.viewCount - a.viewCount);

  return (
    <CardContent className="p-6">
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
                    {formatViews(video.viewCount)}
                  </span>
                  {video.publishDate ? (
                    <span>{formatPublishedDate(video.publishDate, "ru")}</span>
                  ) : (
                    <button
                      onClick={(e) => refreshDate(e, video.videoId)}
                      disabled={refreshingId === video.videoId}
                      title="Обновить дату"
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
    </CardContent>
  );
}

