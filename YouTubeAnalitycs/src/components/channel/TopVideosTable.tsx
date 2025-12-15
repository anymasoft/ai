"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, RefreshCw } from "lucide-react";
import { formatPublishedDateCompact } from "@/lib/date-formatting";
import { canLoadMoreVideos } from "@/config/limits";
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

interface TopVideosTableProps {
  videos: VideoData[];
  /** План пользователя для определения лимитов */
  userPlan?: UserPlan;
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

export function TopVideosTable({ videos, userPlan = "free", channelId }: TopVideosTableProps) {
  const router = useRouter();
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [videoList, setVideoList] = useState(videos);

  // Состояние для постраничной загрузки
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [totalVideos, setTotalVideos] = useState(videos.length);

  const refreshDate = async (videoId: string) => {
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

      console.log(`[TopVideosTable] Loaded page ${data.page}: ${data.videos.length} videos, hasMore: ${data.hasMore}`);

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

  // Сортируем видео по количеству просмотров (DESC)
  const sortedVideos = [...videoList].sort((a, b) => b.viewCount - a.viewCount);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-4">
        <CardTitle>Top Videos</CardTitle>
        <CardDescription>
          Список лучших видео канала по просмотрам
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {sortedVideos.length === 0 ? (
          /* Нет видео в БД */
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground px-4">
            <p className="text-center">
              Видео не найдены. Попробуйте синхронизировать ещё раз.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden">
            <Table className="w-full table-fixed">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[100px] px-5 py-3">Превью</TableHead>
                  <TableHead className="px-5 py-3">Название</TableHead>
                  <TableHead className="w-[110px] px-5 py-3">Просмотры</TableHead>
                  <TableHead className="w-[130px] px-5 py-3">Опубликовано</TableHead>
                  <TableHead className="w-[60px] px-5 py-3 text-center">Ссылка</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedVideos.map((video) => (
                  <TableRow
                    key={video.id}
                    className="hover:bg-muted/50 transition-colors duration-200 border-border/50"
                  >
                    <TableCell className="px-5 py-3 h-16">
                      {video.thumbnailUrl ? (
                        <img
                          src={video.thumbnailUrl}
                          alt={video.title}
                          className="w-full h-full rounded-sm border border-border/50 object-cover hover:opacity-90 transition-opacity"
                        />
                      ) : (
                        <div className="w-full h-full bg-muted rounded-sm flex items-center justify-center text-xs text-muted-foreground">
                          Нет превью
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="px-5 py-3 overflow-hidden">
                      <div className="truncate overflow-hidden text-ellipsis">
                        <div className="font-semibold line-clamp-2 text-foreground" title={video.title}>{video.title}</div>
                      </div>
                    </TableCell>
                    <TableCell className="px-5 py-3">
                      <span className="font-bold text-foreground">{formatViews(video.viewCount)}</span>
                    </TableCell>
                    <TableCell className="px-5 py-3">
                      {video.publishDate ? (
                        <span className="text-sm text-muted-foreground font-medium">
                          {formatPublishedDateCompact(video.publishDate, "ru")}
                        </span>
                      ) : (
                        <button
                          onClick={() => refreshDate(video.videoId)}
                          disabled={refreshingId === video.videoId}
                          title="Обновить дату"
                          className="text-muted-foreground hover:text-foreground disabled:opacity-50"
                        >
                          <RefreshCw className={`h-4 w-4 ${refreshingId === video.videoId ? "animate-spin" : ""}`} />
                        </button>
                      )}
                    </TableCell>
                    <TableCell className="px-5 py-3 text-center">
                      <a
                        href={`https://www.youtube.com/watch?v=${video.videoId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:text-primary/80 transition-colors duration-200"
                        title="Открыть на YouTube"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Кнопка "Показать ещё 12" — только если есть ещё видео и пользователь может загружать */}
        {canLoadMoreVideos(userPlan) && hasMore && (
          <div className="flex justify-center mt-6 px-4 pb-4">
            <Button
              onClick={loadMore}
              variant="outline"
              disabled={isLoadingMore}
            >
              {isLoadingMore ? "Загружаем..." : "Показать ещё 12"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
