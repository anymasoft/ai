import { ExternalLink, Eye, Play, Clock } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import type { VideoPerformanceData } from "@/lib/dashboard-queries"
import { formatPublishedDate } from "@/lib/date-formatting"

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M"
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K"
  }
  return num.toString()
}

function getCategoryBadgeVariant(category: string) {
  switch (category) {
    case "High Momentum":
      return "default"
    case "Rising":
      return "secondary"
    case "Underperforming":
      return "destructive"
    default:
      return "outline"
  }
}

interface RecentVideosProps {
  data: VideoPerformanceData | null
}

export function RecentVideos({ data }: RecentVideosProps) {
  if (!data || data.videos.length === 0) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5" />
            Recent Videos
          </CardTitle>
          <CardDescription>No videos available</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
            <Clock className="h-12 w-12 mb-4 opacity-20" />
            <p className="text-sm text-center">Sync competitor videos to see recent content</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50 hover:border-border/80 transition-colors duration-300">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <Clock className="h-5 w-5 text-primary" />
            Recent Videos
          </CardTitle>
          <CardDescription className="text-sm">Latest competitor uploads</CardDescription>
        </div>
        <Button variant="outline" size="sm" asChild className="bg-background/50 border-border/50 hover:border-border hover:bg-background/80 transition-all">
          <Link href="/trending">
            <Eye className="h-4 w-4 mr-2" />
            View All
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.videos.map((video) => (
          <a
            key={video.videoId}
            href={video.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex p-3 rounded-lg border border-border/50 gap-3 hover:bg-muted/30 hover:border-border/80 transition-all duration-200 group"
          >
            {/* Thumbnail */}
            <div className="relative h-16 w-28 rounded-md overflow-hidden shrink-0 bg-muted">
              {video.thumbnailUrl ? (
                <img
                  src={video.thumbnailUrl}
                  alt={video.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center">
                  <Play className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <ExternalLink className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 space-y-1">
              <p className="text-sm font-medium line-clamp-2 leading-tight">
                {video.title}
              </p>
              <p className="text-xs text-muted-foreground">
                {video.channelTitle}
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={getCategoryBadgeVariant(video.category)} className="text-xs">
                  {video.category === "High Momentum" ? `+${Math.round(video.momentumScore * 100)}%` : video.category}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {formatNumber(video.viewsPerDay)}/day
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatPublishedDate(video.publishedAt, "en")}
                </span>
              </div>
            </div>
          </a>
        ))}
      </CardContent>
    </Card>
  )
}

// Skeleton for Suspense fallback
export function RecentVideosSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="space-y-1">
          <div className="h-5 w-32 bg-muted animate-pulse rounded" />
          <div className="h-4 w-48 bg-muted animate-pulse rounded" />
        </div>
        <div className="h-9 w-20 bg-muted animate-pulse rounded" />
      </CardHeader>
      <CardContent className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex p-3 rounded-lg border gap-3">
            <div className="h-16 w-28 bg-muted animate-pulse rounded-md shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
              <div className="h-3 w-1/2 bg-muted animate-pulse rounded" />
              <div className="h-3 w-1/3 bg-muted animate-pulse rounded" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
