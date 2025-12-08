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
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Flame className="h-5 w-5" />
            Top by Momentum
          </CardTitle>
          <CardDescription>No videos with momentum data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-[200px] text-muted-foreground">
            <Flame className="h-12 w-12 mb-4 opacity-20" />
            <p className="text-sm text-center">Sync competitor videos to see momentum rankings</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Find max momentum for progress bar scaling
  const maxMomentum = Math.max(...data.videos.map(v => v.momentumScore), 1)

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50 hover:border-border/80 transition-colors duration-300">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <Flame className="h-5 w-5 text-orange-500" />
            Top by Momentum
          </CardTitle>
          <CardDescription className="text-sm">
            Best performing videos right now
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" asChild className="bg-background/50 border-border/50 hover:border-border hover:bg-background/80 transition-all">
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
            className="flex items-center p-4 rounded-lg border border-border/50 gap-4 hover:bg-muted/40 hover:border-border/80 hover:shadow-md transition-all duration-300 group"
          >
            {/* Rank */}
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-bold text-sm shrink-0">
              {index + 1}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold truncate text-foreground">{video.title}</p>
                <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="font-medium">{video.channelTitle}</span>
                <span>·</span>
                <span>{formatNumber(video.viewsPerDay)}/день</span>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Progress
                  value={(video.momentumScore / maxMomentum) * 100}
                  className="h-1.5 flex-1"
                />
              </div>
            </div>

            {/* Momentum Badge */}
            <div className="text-right shrink-0 space-y-1">
              <Badge
                variant={video.category === "High Momentum" ? "default" : "secondary"}
                className="gap-1 whitespace-nowrap"
              >
                <TrendingUp className="h-3 w-3" />
                +{Math.round(video.momentumScore * 100)}%
              </Badge>
              <p className="text-xs text-muted-foreground font-medium">
                {formatNumber(video.viewCount)} views
              </p>
            </div>
          </a>
        ))}

        {/* Stats footer */}
        <div className="pt-4 mt-2 border-t flex items-center justify-between text-xs text-muted-foreground font-medium">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <Zap className="h-3 w-3 text-orange-500" />
              {data.stats.highMomentum} momentum
            </span>
            <span className="flex items-center gap-1.5">
              <TrendingUp className="h-3 w-3 text-green-500" />
              {data.stats.rising} rising
            </span>
          </div>
          <span>{data.total} всего</span>
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
