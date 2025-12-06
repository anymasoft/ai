"use client";

import { useState } from "react";
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

interface TopVideosGridProps {
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
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch (error) {
    return dateString;
  }
}

export function TopVideosGrid({ videos }: TopVideosGridProps) {
  const [limit, setLimit] = useState(24);

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
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {visibleVideos.map((video) => (
                <Card
                  key={video.id}
                  className="group overflow-hidden transition-all duration-200 hover:shadow-lg hover:scale-[1.03]"
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

                    <div className="p-4 space-y-3">
                      <h3 className="font-medium text-sm leading-tight line-clamp-2 min-h-[2.5rem]">
                        {video.title}
                      </h3>

                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-foreground">
                          {formatViews(video.viewCount)} просмотров
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {formatDate(video.publishedAt)}
                        </span>
                      </div>

                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="w-full"
                      >
                        <a
                          href={`https://www.youtube.com/watch?v=${video.videoId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Открыть видео на YouTube
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {sortedVideos.length > limit && (
              <div className="flex justify-center mt-6">
                <Button
                  onClick={() => setLimit((prev) => prev + 24)}
                  variant="outline"
                >
                  Показать ещё 24
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
