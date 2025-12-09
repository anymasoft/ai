"use client";

import { useState } from "react";
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

export function TopVideosTable({ videos }: TopVideosTableProps) {
  const [limit, setLimit] = useState(50);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [videoList, setVideoList] = useState(videos);

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

  // Сортируем видео по количеству просмотров (DESC)
  const sortedVideos = [...videoList].sort((a, b) => b.viewCount - a.viewCount);
  const visibleVideos = sortedVideos.slice(0, limit);

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
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground px-4">
            <p className="text-center">
              Нет данных. Нажмите &quot;Sync Top Videos&quot; чтобы загрузить видео канала.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[120px] px-5 py-3">Превью</TableHead>
                  <TableHead className="px-5 py-3">Название</TableHead>
                  <TableHead className="w-[120px] px-5 py-3">Просмотры</TableHead>
                  <TableHead className="w-[140px] px-5 py-3">Опубликовано</TableHead>
                  <TableHead className="w-[80px] px-5 py-3 text-center">Ссылка</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleVideos.map((video) => (
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
                    <TableCell className="px-5 py-3">
                      <div className="max-w-md">
                        <div className="font-semibold line-clamp-2 text-foreground">{video.title}</div>
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

        {sortedVideos.length > limit && (
          <div className="flex justify-center mt-6 px-4 pb-4">
            <Button
              onClick={() => setLimit((prev) => prev + 50)}
              variant="outline"
            >
              Показать ещё 50
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
