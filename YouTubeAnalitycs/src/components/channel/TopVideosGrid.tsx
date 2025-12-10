"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { formatPublishedDate } from "@/lib/date-formatting";
import { VIDEO_PAGE_SIZE, TIER_VIDEO_LIMITS, canLoadMoreVideos } from "@/config/limits";
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
  /** План пользователя для определения лимитов. По умолчанию "free" */
  userPlan?: UserPlan;
  /** Нажал ли пользователь "Получить топ-видео" */
  hasShownVideos?: boolean;
  /** ID конкурента для вызова API */
  channelId?: number;
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

export function TopVideosGrid({ videos, userPlan = "free", hasShownVideos = false, channelId }: TopVideosGridProps) {
  const router = useRouter();
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  // НОВОЕ (ИТЕРАЦИЯ 9): Начинаем с пустого списка (видео теперь загружаются только на клиенте через /api)
  const [videoList, setVideoList] = useState<VideoData[]>([]);
  const [showingVideos, setShowingVideos] = useState(false);

  // Состояние для постраничной загрузки
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);  // НОВОЕ (ИТЕРАЦИЯ 9): Начинаем с false
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [totalVideos, setTotalVideos] = useState(0);  // НОВОЕ (ИТЕРАЦИЯ 9): Начинаем с 0

  // Локальное состояние для управления показом видео
  const [hasShown, setHasShown] = useState(hasShownVideos);

  // НОВОЕ (ИТЕРАЦИЯ 9): Логируем инициализацию
  if (process.env.NODE_ENV === "development") {
    console.log("[TopVideosGrid INIT (v9)] Pure client-side pagination mode", {
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
      const result = await res.json();
      if (result.success && result.publishDate) {
        setVideoList(prev => prev.map(v =>
          v.videoId === videoId ? { ...v, publishDate: result.publishDate } : v
        ));
      }
    } catch (err) {
      console.error("Ошибка обновления даты:", err);
    } finally {
      setRefreshingId(null);
    }
  };

  const handleGetTopVideos = async () => {
    if (!channelId) {
      console.error("[TopVideosGrid] channelId not provided");
      return;
    }

    console.log(`[TopVideosGrid] Начало получения топ-видео для channelId=${channelId}`);
    setShowingVideos(true);
    try {
      // Шаг 1: Синхронизируем видео
      console.log(`[TopVideosGrid] Шаг 1: Синхронизация видео...`);
      const syncRes = await fetch(`/api/channel/${channelId}/videos/sync`, {
        method: "POST",
        cache: "no-store",
      });

      if (!syncRes.ok) {
        const syncError = await syncRes.json();
        console.error(`[TopVideosGrid] Ошибка синхронизации:`, syncError);
        return;
      }

      const syncData = await syncRes.json();
      console.log(`[TopVideosGrid] Синхронизация успешна:`, {
        status: syncData.status,
        videosCount: syncData.videos?.length,
        totalVideos: syncData.totalVideos,
        added: syncData.added,
        updated: syncData.updated,
      });

      // Шаг 2: Отмечаем видео как показанные
      console.log(`[TopVideosGrid] Шаг 2: Отметить видео как показанные...`);
      const showRes = await fetch(`/api/channel/${channelId}/videos/show`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });

      if (!showRes.ok) {
        const showError = await showRes.json();
        console.error(`[TopVideosGrid] Ошибка при отметке видео:`, showError);
        return;
      }

      const showData = await showRes.json();
      console.log(`[TopVideosGrid] Видео отмечены как показанные:`, showData);

      // Шаг 3: НОВОЕ - загружаем первую страницу видео сразу на клиенте
      console.log(`[TopVideosGrid] Шаг 3: Загрузка первой страницы видео...`);
      const pageRes = await fetch(
        `/api/channel/${channelId}/videos/page?page=0`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      if (!pageRes.ok) {
        console.error(`[TopVideosGrid] Ошибка загрузки первой страницы:`, pageRes.status);
        // Fallback на router.refresh если прямая загрузка не удалась
        console.log("[TopVideosGrid] Используем fallback router.refresh()");
        router.refresh();
        return;
      }

      const pageData = await pageRes.json();
      console.log(`[TopVideosGrid] Первая страница загружена:`, {
        videosCount: pageData.videos?.length,
        hasMore: pageData.hasMore,
        page: pageData.page,
      });

      // КЛЮЧЕВОЙ ШАГ: обновляем локальное состояние для немедленного отображения
      if (pageData.videos && pageData.videos.length > 0) {
        setVideoList(pageData.videos);
        setHasShown(true);
        setPage(pageData.page ?? 0);
        setHasMore(pageData.hasMore ?? false);
        setTotalVideos(pageData.totalVideos ?? pageData.videos.length);
        console.log("[TopVideosGrid] Локальное состояние обновлено, видео готовы к отображению");
      } else {
        // Видео не найдены, но состояние отмечено как "показано"
        setHasShown(true);
        setVideoList([]);
        console.log("[TopVideosGrid] Видео не найдены, но состояние отмечено как показано");
      }

      // Шаг 4: Мягкий бэкап - попробуем router.refresh() для синхронизации SSR, но не критично
      try {
        console.log("[TopVideosGrid] Шаг 4: Выполняем router.refresh() как бэкап для SSR...");
        router.refresh();
        console.log("[TopVideosGrid] router.refresh() выполнен успешно");
      } catch (refreshErr) {
        console.warn("[TopVideosGrid] router.refresh() failed (non-critical):", refreshErr);
      }
    } catch (err) {
      console.error(`[TopVideosGrid] Ошибка при получении топ-видео:`, err instanceof Error ? err.message : err);
    } finally {
      setShowingVideos(false);
    }
  };

  // ИТЕРАЦИЯ 10: Загружаем следующую страницу видео
  const loadMore = async () => {
    if (!channelId || isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      const nextPage = page + 1;
      console.log(`[TopVideosGrid] Загрузка страницы ${nextPage}...`);

      const res = await fetch(
        `/api/channel/${channelId}/videos/page?page=${nextPage}`,
        { cache: "no-store" }
      );

      if (!res.ok) {
        console.error(`[TopVideosGrid] Ошибка загрузки страницы ${nextPage}: HTTP ${res.status}`);
        return;
      }

      const data = await res.json();

      console.log(`[TopVideosGrid] Страница ${data.page}: загружено ${data.videos?.length} видео, hasMore=${data.hasMore}`);

      // Добавляем новые видео к существующему ЛОКАЛЬНОМУ списку
      if (data.videos && data.videos.length > 0) {
        setVideoList(prev => [...prev, ...data.videos]);
        setPage(data.page);
        setHasMore(data.hasMore ?? false);
        setTotalVideos(data.totalVideos ?? totalVideos);
      } else {
        console.log(`[TopVideosGrid] Видео на странице ${nextPage} не найдены`);
        setHasMore(false);
      }
    } catch (err) {
      console.error("[TopVideosGrid] Ошибка при загрузке видео:", err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Определяем лимит по тарифу пользователя (осталось для совместимости, но не используется)
  const planLimit = TIER_VIDEO_LIMITS[userPlan];  // больше не используется в ИТЕРАЦИИ 10
  // const canLoadMore = canLoadMoreVideos(userPlan);  // ИТЕРАЦИЯ 10: отключено

  // Сортируем видео по количеству просмотров (DESC)
  const sortedVideos = [...videoList].sort((a, b) => b.viewCount - a.viewCount);

  // Debug в dev режиме
  if (process.env.NODE_ENV === "development") {
    console.log(`[TopVideosGrid RENDER]`, {
      userPlan,
      planLimit,
      totalLoaded: videoList.length,
      hasMore,
      hasShown,
      page,
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
                  key={video.id}
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

            {/* Кнопка "Показать ещё 12" — только если есть ещё видео (ИТЕРАЦИЯ 10: без проверки плана) */}
            {hasShown && hasMore && (
              <div className="flex justify-center mt-6">
                <Button
                  onClick={loadMore}
                  variant="outline"
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? "Загружаем..." : "Показать ещё 12"}
                </Button>
              </div>
            )}
          </>
        )}
      </>
    </CardContent>
  );
}
