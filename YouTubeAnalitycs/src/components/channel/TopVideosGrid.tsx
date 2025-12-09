"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  publishedAt: string | null;
  fetchedAt: number;
}

interface TopVideosGridProps {
  videos: VideoData[];
  /** План пользователя для определения лимитов. По умолчанию "free" */
  userPlan?: UserPlan;
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

export function TopVideosGrid({ videos, userPlan = "free" }: TopVideosGridProps) {
  // Используем VIDEO_PAGE_SIZE (12) вместо хардкода 24
  const [visibleCount, setVisibleCount] = useState(VIDEO_PAGE_SIZE);

  // Определяем лимит по тарифу пользователя
  const planLimit = TIER_VIDEO_LIMITS[userPlan];
  // Фактическое количество доступных видео (не больше чем есть в БД и не больше лимита тарифа)
  const totalAvailable = Math.min(videos.length, planLimit);
  // Может ли пользователь догружать (план позволяет > 12)
  const canLoadMore = canLoadMoreVideos(userPlan);

  // Сортируем видео по количеству просмотров (DESC)
  const sortedVideos = [...videos].sort((a, b) => b.viewCount - a.viewCount);
  // Показываем не больше visibleCount и не больше totalAvailable
  const visibleVideos = sortedVideos.slice(0, Math.min(visibleCount, totalAvailable));

  // Debug в dev режиме
  if (process.env.NODE_ENV === "development") {
    console.log(`[TopVideosGrid] Plan: ${userPlan}, Limit: ${planLimit}, Total in DB: ${videos.length}, Available: ${totalAvailable}, Visible: ${visibleVideos.length}`);
  }

  return (
    <CardContent className="p-6">
      <>
        {sortedVideos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <p className="text-center">
              Нет данных. Нажмите &quot;Sync Top Videos&quot; чтобы загрузить видео канала.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {visibleVideos.map((video) => (
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
                        <span>
                          {formatPublishedDate(video.publishedAt, "ru")}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Кнопка "Load more" — только если план позволяет и есть ещё видео */}
            {canLoadMore && visibleCount < totalAvailable && (
              <div className="flex justify-center mt-6">
                <Button
                  onClick={() => setVisibleCount((prev) => Math.min(prev + VIDEO_PAGE_SIZE, totalAvailable))}
                  variant="outline"
                >
                  Load more {VIDEO_PAGE_SIZE} videos
                </Button>
              </div>
            )}

            {/* Сообщение для базовых планов без Load more */}
            {!canLoadMore && videos.length > VIDEO_PAGE_SIZE && (
              <div className="flex justify-center mt-6">
                <p className="text-sm text-muted-foreground">
                  Only {VIDEO_PAGE_SIZE} videos available on your current plan.
                </p>
              </div>
            )}
          </>
        )}
      </>
    </CardContent>
  );
}
