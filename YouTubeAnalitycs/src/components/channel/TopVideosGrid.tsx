"use client";

import { useState } from "react";
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
  /** Синхронизировал ли пользователь видео этого канала */
  hasSyncedTopVideos?: boolean;
  /** Нажал ли пользователь "Показать топ-видео" */
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

export function TopVideosGrid({ videos, userPlan = "free", hasSyncedTopVideos = false, hasShownVideos = false, channelId }: TopVideosGridProps) {
  const router = useRouter();
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [videoList, setVideoList] = useState(videos);
  const [showingVideos, setShowingVideos] = useState(false);

  // Состояние для постраничной загрузки
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [totalVideos, setTotalVideos] = useState(videos.length);

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

  const handleShowVideos = async () => {
    if (!channelId) {
      console.error("channelId not provided");
      return;
    }

    setShowingVideos(true);
    try {
      const res = await fetch(`/api/channel/${channelId}/videos/show`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const result = await res.json();

      if (!res.ok) {
        console.error("Failed to show videos:", result.error);
        return;
      }

      // Обновляем UI после успешного вызова
      router.refresh();
    } catch (err) {
      console.error("Ошибка при показе видео:", err);
    } finally {
      setShowingVideos(false);
    }
  };

  // Загружаем следующую страницу видео
  const loadMore = async () => {
    if (!channelId || isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      const res = await fetch(`/api/channel/${channelId}/videos/page?page=${page + 1}`);
      const data = await res.json();

      if (!data.ok) {
        console.error("Failed to load more videos:", data.error);
        return;
      }

      console.log(`[TopVideosGrid] Loaded page ${data.page}: ${data.videos.length} videos, hasMore: ${data.hasMore}`);

      // Добавляем новые видео к существующему списку
      setVideoList(prev => [...prev, ...data.videos]);
      setPage(data.page);
      setHasMore(data.hasMore);
      setTotalVideos(data.totalVideos);
    } catch (err) {
      console.error("Ошибка при загрузке видео:", err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Определяем лимит по тарифу пользователя
  const planLimit = TIER_VIDEO_LIMITS[userPlan];
  // Может ли пользователь загружать больше видео
  const canLoadMore = canLoadMoreVideos(userPlan);

  // Сортируем видео по количеству просмотров (DESC)
  const sortedVideos = [...videoList].sort((a, b) => b.viewCount - a.viewCount);

  // Debug в dev режиме
  if (process.env.NODE_ENV === "development") {
    console.log(`[TopVideosGrid] Plan: ${userPlan}, Limit: ${planLimit}, Total loaded: ${videoList.length}, HasMore: ${hasMore}`);
  }

  return (
    <CardContent className="p-6">
      <>
        {/* Сценарий A: пользователь ещё не синхронизировал видео */}
        {!hasSyncedTopVideos ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <p className="text-center">
              Нет данных. Нажмите &quot;Sync Top Videos&quot; чтобы загрузить видео канала.
            </p>
          </div>
        ) : !hasShownVideos ? (
          /* Сценарий B: синхронизировано, но "Показать" ещё не нажимали */
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <div className="flex flex-col items-center justify-center gap-4">
              <p className="text-center">
                Нет данных. Нажмите кнопку ниже, чтобы загрузить топ-видео.
              </p>
              <Button
                onClick={() => handleShowVideos()}
                variant="default"
                size="sm"
                disabled={showingVideos}
              >
                {showingVideos ? "Загружаем..." : "Показать топ-видео"}
              </Button>
            </div>
          </div>
        ) : sortedVideos.length === 0 ? (
          /* Сценарий C: синхронизировано и показано, но видео нет в БД */
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <p className="text-center">
              Видео не найдены. Попробуйте синхронизировать ещё раз.
            </p>
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

            {/* Кнопка "Показать ещё 12" — только если есть ещё видео и пользователь может загружать */}
            {hasShownVideos && canLoadMore && hasMore && (
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

            {/* Сообщение для базовых планов без Load more */}
            {!canLoadMore && videoList.length > VIDEO_PAGE_SIZE && (
              <div className="flex justify-center mt-6">
                <p className="text-sm text-muted-foreground">
                  Ваш тариф ограничивает количество доступных видео. Перейдите на Professional, чтобы видеть больше данных.
                </p>
              </div>
            )}
          </>
        )}
      </>
    </CardContent>
  );
}
