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
import { ExternalLink } from "lucide-react";

interface VideoData {
  id: number;
  channelId: string;
  videoId: string;
  title: string;
  thumbnailUrl: string | null;
  viewCount: number;
  publishedAt: string;
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

/**
 * Форматирует дату публикации
 */
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch (error) {
    return dateString;
  }
}

export function TopVideosTable({ videos }: TopVideosTableProps) {
  const [limit, setLimit] = useState(50);

  // Сортируем видео по количеству просмотров (DESC)
  const sortedVideos = [...videos].sort((a, b) => b.viewCount - a.viewCount);
  const visibleVideos = sortedVideos.slice(0, limit);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Videos</CardTitle>
        <CardDescription>
          Список лучших видео канала по просмотрам
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sortedVideos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <p className="text-center">
              Нет данных. Нажмите &quot;Sync Top Videos&quot; чтобы загрузить видео канала.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Превью</TableHead>
                  <TableHead>Название</TableHead>
                  <TableHead className="w-[120px]">Просмотры</TableHead>
                  <TableHead className="w-[140px]">Опубликовано</TableHead>
                  <TableHead className="w-[80px] text-center">Ссылка</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleVideos.map((video) => (
                  <TableRow key={video.id}>
                    <TableCell>
                      {video.thumbnailUrl ? (
                        <img
                          src={video.thumbnailUrl}
                          alt={video.title}
                          className="w-full h-auto rounded border border-border object-cover"
                        />
                      ) : (
                        <div className="w-full aspect-video bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">
                          Нет превью
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="max-w-md">
                        <div className="font-medium line-clamp-2">{video.title}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold">{formatViews(video.viewCount)}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(video.publishedAt)}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <a
                        href={`https://www.youtube.com/watch?v=${video.videoId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
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
          <div className="flex justify-center mt-4">
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
