import { ExternalLink, Eye, TrendingUp, Zap, Flame } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import Link from "next/link"
import type { VideoPerformanceData } from "@/lib/dashboard-queries"

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M"
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K"
  }
  return num.toString()
}

interface TopVideosByMomentumProps {
  data: VideoPerformanceData | null
}

export function TopVideosByMomentum({ data }: TopVideosByMomentumProps) {
  if (!data || data.videos.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5" />
            Top by Momentum
          </CardTitle>
          <CardDescription>No videos with momentum data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[200px] text-muted-foreground">
            Sync competitor videos to see momentum rankings
          </div>
        </CardContent>
      </Card>
    )
  }

  // Find max momentum for progress bar scaling
  const maxMomentum = Math.max(...data.videos.map(v => v.momentumScore), 1)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-500" />
            Top by Momentum
          </CardTitle>
          <CardDescription>
            Best performing videos right now
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/trending">
            <Eye className="h-4 w-4 mr-2" />
            View All
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.videos.map((video, index) => (
          <a
            key={video.videoId}
            href={video.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center p-3 rounded-lg border gap-3 hover:bg-muted/50 transition-colors group"
          >
            {/* Rank */}
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm shrink-0">
              #{index + 1}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-medium truncate">{video.title}</p>
                <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{video.channelTitle}</span>
                <span>-</span>
                <span>{formatNumber(video.viewsPerDay)}/day</span>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Progress
                  value={(video.momentumScore / maxMomentum) * 100}
                  className="h-1.5 flex-1"
                />
              </div>
            </div>

            {/* Momentum Badge */}
            <div className="text-right shrink-0">
              <Badge
                variant={video.category === "High Momentum" ? "default" : "secondary"}
                className="gap-1"
              >
                <TrendingUp className="h-3 w-3" />
                +{Math.round(video.momentumScore * 100)}%
              </Badge>
              <p className="text-xs text-muted-foreground mt-1">
                {formatNumber(video.viewCount)} views
              </p>
            </div>
          </a>
        ))}

        {/* Stats footer */}
        <div className="pt-3 border-t flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Zap className="h-3 w-3 text-orange-500" />
              {data.stats.highMomentum} high momentum
            </span>
            <span className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-green-500" />
              {data.stats.rising} rising
            </span>
          </div>
          <span>{data.total} total videos</span>
        </div>
      </CardContent>
    </Card>
  )
}

// Skeleton for Suspense fallback
export function TopVideosByMomentumSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="space-y-1">
          <div className="h-5 w-40 bg-muted animate-pulse rounded" />
          <div className="h-4 w-56 bg-muted animate-pulse rounded" />
        </div>
        <div className="h-9 w-20 bg-muted animate-pulse rounded" />
      </CardHeader>
      <CardContent className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center p-3 rounded-lg border gap-3">
            <div className="h-8 w-8 bg-muted animate-pulse rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
              <div className="h-3 w-1/2 bg-muted animate-pulse rounded" />
            </div>
            <div className="h-6 w-16 bg-muted animate-pulse rounded" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
