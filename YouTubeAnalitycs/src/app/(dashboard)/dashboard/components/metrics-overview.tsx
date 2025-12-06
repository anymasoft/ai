"use client"

import { useEffect, useState } from "react"
import {
  TrendingUp,
  TrendingDown,
  Users,
  Eye,
  Tv,
  Zap,
  ExternalLink
} from "lucide-react"
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"

interface KPIData {
  totalCompetitors: number
  totalSubscribers: number
  totalVideos: number
  totalViews: number
  avgMomentum: number
  topMomentumVideo: {
    videoId: string
    title: string
    channelTitle: string
    viewsPerDay: number
    momentumScore: number
    url: string
  } | null
  totalScriptsGenerated: number
}

function formatNumber(num: number): string {
  if (num >= 1000000000) {
    return (num / 1000000000).toFixed(1) + "B"
  } else if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M"
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K"
  }
  return num.toString()
}

function MetricCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-16 mt-2" />
        <CardAction>
          <Skeleton className="h-5 w-16" />
        </CardAction>
      </CardHeader>
      <CardFooter className="flex-col items-start gap-1.5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
      </CardFooter>
    </Card>
  )
}

export function MetricsOverview() {
  const [data, setData] = useState<KPIData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchKPI() {
      try {
        const response = await fetch("/api/dashboard/kpi")
        if (!response.ok) {
          throw new Error("Failed to fetch KPI data")
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

    fetchKPI()
  }, [])

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
      </div>
    )
  }

  if (error || !data) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center text-muted-foreground">
          <p>{error || "No data available"}</p>
        </div>
      </Card>
    )
  }

  const metrics = [
    {
      title: "Tracked Channels",
      value: data.totalCompetitors.toString(),
      icon: Tv,
      trend: data.totalCompetitors > 0 ? "up" : "neutral",
      badge: data.totalCompetitors > 0 ? "Active" : "None",
      footer: data.totalCompetitors > 0 ? "Monitoring competitors" : "Add channels to track",
      subfooter: `${data.totalScriptsGenerated} scripts generated`
    },
    {
      title: "Total Subscribers",
      value: formatNumber(data.totalSubscribers),
      icon: Users,
      trend: "up",
      badge: formatNumber(data.totalSubscribers),
      footer: "Combined audience reach",
      subfooter: "Across all channels"
    },
    {
      title: "Total Views",
      value: formatNumber(data.totalViews),
      icon: Eye,
      trend: "up",
      badge: formatNumber(data.totalViews),
      footer: "Cumulative view count",
      subfooter: `${formatNumber(data.totalVideos)} videos tracked`
    },
    {
      title: "Top Momentum",
      value: data.topMomentumVideo
        ? `+${Math.round(data.topMomentumVideo.momentumScore * 100)}%`
        : "—",
      icon: Zap,
      trend: data.topMomentumVideo && data.topMomentumVideo.momentumScore > 0.5 ? "up" : "neutral",
      badge: data.topMomentumVideo
        ? `${formatNumber(data.topMomentumVideo.viewsPerDay)}/day`
        : "No data",
      footer: data.topMomentumVideo
        ? data.topMomentumVideo.title.slice(0, 40) + (data.topMomentumVideo.title.length > 40 ? "..." : "")
        : "No high momentum videos",
      subfooter: data.topMomentumVideo?.channelTitle || "Sync videos first",
      link: data.topMomentumVideo?.url
    },
  ]

  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => {
        const TrendIcon = metric.trend === "up" ? TrendingUp : metric.trend === "down" ? TrendingDown : TrendingUp
        const IconComponent = metric.icon

        return (
          <Card
            key={metric.title}
            className={metric.link ? "cursor-pointer hover:shadow-md transition-shadow" : ""}
            onClick={() => metric.link && window.open(metric.link, "_blank")}
          >
            <CardHeader>
              <CardDescription className="flex items-center gap-2">
                <IconComponent className="h-4 w-4" />
                {metric.title}
              </CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {metric.value}
              </CardTitle>
              <CardAction>
                <Badge variant="outline" className="gap-1">
                  {metric.trend !== "neutral" && <TrendIcon className="h-3 w-3" />}
                  {metric.badge}
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
              <div className="line-clamp-1 flex gap-2 font-medium items-center">
                {metric.footer}
                {metric.link && <ExternalLink className="h-3 w-3 text-muted-foreground" />}
              </div>
              <div className="text-muted-foreground line-clamp-1">
                {metric.subfooter}
              </div>
            </CardFooter>
          </Card>
        )
      })}
    </div>
  )
}
