"use client"

import {
  TrendingUp,
  TrendingDown,
  Users,
  Video,
  Eye,
  BarChart3
} from "lucide-react"
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface CompetitorStats {
  totalCompetitors: number
  totalSubscribers: number
  totalViews: number
  totalVideos: number
}

interface MetricsOverviewProps {
  stats: CompetitorStats
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

export function MetricsOverview({ stats }: MetricsOverviewProps) {
  const metrics = [
    {
      title: "Tracked Competitors",
      value: stats.totalCompetitors.toString(),
      description: "YouTube channels",
      change: stats.totalCompetitors > 0 ? "Active" : "None",
      trend: stats.totalCompetitors > 0 ? "up" : "down",
      icon: Users,
      footer: stats.totalCompetitors > 0 ? "Monitoring competitors" : "Add competitors to track",
      subfooter: "Track up to your plan limit"
    },
    {
      title: "Total Subscribers",
      value: formatNumber(stats.totalSubscribers),
      description: "Combined audience",
      change: stats.totalSubscribers > 0 ? formatNumber(stats.totalSubscribers) : "0",
      trend: "up",
      icon: Users,
      footer: "Aggregated from competitors",
      subfooter: "Total subscriber base"
    },
    {
      title: "Total Videos",
      value: formatNumber(stats.totalVideos),
      description: "Content published",
      change: stats.totalVideos > 0 ? formatNumber(stats.totalVideos) : "0",
      trend: "up",
      icon: Video,
      footer: "Video content tracked",
      subfooter: "Competitor video count"
    },
    {
      title: "Total Views",
      value: formatNumber(stats.totalViews),
      description: "Cumulative views",
      change: stats.totalViews > 0 ? formatNumber(stats.totalViews) : "0",
      trend: "up",
      icon: Eye,
      footer: "Combined view count",
      subfooter: "Aggregate performance"
    },
  ]

  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs grid gap-4 sm:grid-cols-2 @5xl:grid-cols-4">
      {metrics.map((metric) => {
        const TrendIcon = metric.trend === "up" ? TrendingUp : TrendingDown
        
        return (
          <Card key={metric.title} className=" cursor-pointer">
            <CardHeader>
              <CardDescription>{metric.title}</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {metric.value}
              </CardTitle>
              <CardAction>
                <Badge variant="outline">
                  <TrendIcon className="h-4 w-4" />
                  {metric.change}
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
              <div className="line-clamp-1 flex gap-2 font-medium">
                {metric.footer} <TrendIcon className="size-4" />
              </div>
              <div className="text-muted-foreground">
                {metric.subfooter}
              </div>
            </CardFooter>
          </Card>
        )
      })}
    </div>
  )
}
