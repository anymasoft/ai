"use client"

import { useEffect, useState } from "react"
import { ExternalLink, Eye, Play, Clock } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { formatMomentumPercent } from "@/lib/momentum-formatting"

interface VideoData {
  videoId: string
  title: string
  channelId: string
  channelTitle: string
  thumbnailUrl: string | null
  viewCount: number
  likeCount: number
  commentCount: number
  publishDate: string
  viewsPerDay: number
  momentumScore: number
  category: "High Momentum" | "Rising" | "Normal" | "Underperforming"
  url: string
}

interface VideoPerformanceData {
  videos: VideoData[]
  sortBy: string
  limit: number
  total: number
  medianViewsPerDay: number
  stats: {
    highMomentum: number
    rising: number
    normal: number
    underperforming: number
  }
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M"
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K"
  }
  return num.toString()
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
  return `${Math.floor(diffDays / 365)} years ago`
}

function VideoCardSkeleton() {
  return (
    <div className="flex p-3 rounded-lg border gap-3">
      <Skeleton className="h-16 w-28 rounded-md shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  )
}

export function RecentVideos() {
  const [data, setData] = useState<VideoPerformanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchVideos() {
      try {
        const response = await fetch("/api/dashboard/video-performance?sortBy=recent&limit=5")
        if (!response.ok) {
          throw new Error("Failed to fetch recent videos")
        }
        const result = await response.json()
        if (result.success) {
          setData(result.data)
        } else {
          throw new Error(result.error || "Unknown error")
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data")
      } finally {
        setLoading(false)
      }
    }

    fetchVideos()
  }, [])

  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="space-y-1">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-9 w-20" />
        </CardHeader>
        <CardContent className="space-y-3">
          <VideoCardSkeleton />
          <VideoCardSkeleton />
          <VideoCardSkeleton />
          <VideoCardSkeleton />
          <VideoCardSkeleton />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Videos</CardTitle>
          <CardDescription className="text-destructive">{error}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const getCategoryBadgeVariant = (category: string) => {
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

  if (!data || data.videos.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Videos
          </CardTitle>
          <CardDescription>No videos available</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[200px] text-muted-foreground">
            Sync competitor videos to see recent content
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Videos
          </CardTitle>
          <CardDescription>Latest competitor uploads</CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open("/trending", "_self")}
        >
          <Eye className="h-4 w-4 mr-2" />
          View All
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.videos.map((video) => (
          <a
            key={video.videoId}
            href={video.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex p-3 rounded-lg border gap-3 hover:bg-muted/50 transition-colors group"
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
                  {video.category === "High Momentum" ? formatMomentumPercent(video.momentumScore) : video.category}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {formatNumber(video.viewsPerDay)}/day
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatTimeAgo(video.publishDate)}
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
