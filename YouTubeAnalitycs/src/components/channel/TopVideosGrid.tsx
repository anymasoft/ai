"use client";

import { useState, useEffect } from "react";
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
  /** Нажал ли пользователь "Получить топ-видео" */
  hasShownVideos?: boolean;
}

/**
 * Форматирует числа для читаемости (1000000 => 1.2M)
 */
function formatViews(views: number): string {
  if (views >= 1000000) {
    return `${(views / 1000000).toFixed(1)}M`;
  }
  if (views >= 1000) {
    return `${(views / 1000).toFixed(1)}K`;
  }
  return views.toString();
}

export function TopVideosGrid({ videos, channelId, userPlan = "free", hasShownVideos = false }: TopVideosGridProps) {
  const router = useRouter();
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [videoList, setVideoList] = useState<VideoData[]>([]);
  const [showingVideos, setShowingVideos] = useState(false);
  const [hasShown, setHasShown] = useState(hasShownVideos);

  // Защита: если channelId не передан, не рендерим компонент
  if (!channelId) {
    console.error("[TopVideosGrid] channelId is undefined, component cannot render");
    return null;
  }

  if (process.env.NODE_ENV === "development") {
    console.log("[TopVideosGrid] TOP-12 ONLY mode", {
      channelId,
      userPlan,
      hasShownVideos,
      initialVideoListLength: videoList.length,
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
        setVideoList(prev => prev.map(v =>
          v.videoId === videoId ? { ...v, publishDate: result.publishDate } : v
        ));
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
    setShowingVideos(true);
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

      // Обновляем состояние с полученными видео
      if (syncData.videos && syncData.videos.length > 0) {
        setVideoList(syncData.videos);
        setHasShown(true);
        console.log(`[TopVideosGrid] Видео обновлены (${syncData.videos.length} штук)`);
      } else {
        setHasShown(true);
        setVideoList([]);
        console.log("[TopVideosGrid] Видео не найдены");
      }

      // Обновляем UI через router.refresh()
      try {
        router.refresh();
      } catch (err) {
        console.warn("[TopVideosGrid] router.refresh() failed (non-critical):", err);
      }
    } catch (err) {
      console.error(`[TopVideosGrid] Ошибка:`, err instanceof Error ? err.message : err);
    } finally {
      setShowingVideos(false);
    }
  };


  // Сортируем видео по количеству просмотров (DESC)
  const sortedVideos = [...videoList].sort((a, b) => b.viewCount - a.viewCount);

  // Debug в dev режиме
  if (process.env.NODE_ENV === "development") {
    console.log(`[TopVideosGrid RENDER] TOP-12 ONLY`, {
      totalLoaded: videoList.length,
      hasShown,
    });
  }

  return (
    <CardContent className="p-6">
      <>
        {/* STATE 1: Пользователь никогда не нажимал кнопку "Получить топ-видео" */}
        {!hasShown ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <div className="flex flex-col items-center justify-center gap-4">
              <p className="text-center">
                Нет данных. Нажмите «Получить топ-видео», чтобы загрузить первые ролики.
              </p>
              <Button
                onClick={() => handleGetTopVideos()}
                variant="default"
                size="sm"
                disabled={showingVideos}
              >
                {showingVideos ? "Загружаем..." : "Получить топ-видео"}
              </Button>
            </div>
          </div>
        ) : sortedVideos.length === 0 ? (
          /* Пользователь нажимал кнопку, но видео не найдены */
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <p className="text-center">
              Видео не найдены. Попробуйте получить топ-видео ещё раз.
            </p>
            <Button
              onClick={() => handleGetTopVideos()}
              variant="outline"
              size="sm"
              className="mt-4"
              disabled={showingVideos}
            >
              {showingVideos ? "Загружаем..." : "Получить топ-видео"}
            </Button>
          </div>
        ) : (
          <>
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

          </>
        )}
      </>
    </CardContent>
  );
}
