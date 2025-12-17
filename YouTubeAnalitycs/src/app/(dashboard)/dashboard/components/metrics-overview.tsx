import {
  TrendingUp,
  Users,
  Eye,
  Tv,
  Zap,
  ExternalLink
} from "lucide-react"
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { KPIData } from "@/lib/dashboard-queries"
import { formatMomentumPercent } from "@/lib/momentum-formatting"

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

interface MetricsOverviewProps {
  data: KPIData | null
}

export function MetricsOverview({ data }: MetricsOverviewProps) {
  if (!data) {
    return (
      <Card className="p-6 bg-card/50 backdrop-blur-sm border-border/50">
        <div className="flex items-center justify-center text-muted-foreground">
          <p>Не удалось загрузить метрики</p>
        </div>
      </Card>
    )
  }

  const metrics = [
    {
      title: "Отслеживаемые каналы",
      value: data.totalCompetitors.toString(),
      icon: Tv,
      trend: data.totalCompetitors > 0 ? "up" : "neutral",
      badge: data.totalCompetitors > 0 ? "Активные" : "Нет",
      footer: data.totalCompetitors > 0 ? "Отслеживание конкурентов" : "Добавьте каналы для отслеживания",
      subfooter: `${data.totalScriptsGenerated} сгенерировано сценариев`
    },
    {
      title: "Всего подписчиков",
      value: formatNumber(data.totalSubscribers),
      icon: Users,
      trend: "up",
      badge: formatNumber(data.totalSubscribers),
      footer: "Общий охват аудитории",
      subfooter: "По всем каналам"
    },
    {
      title: "Всего просмотров",
      value: formatNumber(data.totalViews),
      icon: Eye,
      trend: "up",
      badge: formatNumber(data.totalViews),
      footer: "Совокупное количество просмотров",
      subfooter: `${formatNumber(data.totalVideos)} отслеживается видео`
    },
    {
      title: "Лучший Momentum",
      value: data.topMomentumVideo
        ? formatMomentumPercent(data.topMomentumVideo.momentumScore)
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
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => {
        const TrendIcon = TrendingUp
        const IconComponent = metric.icon

        return (
          <Card
            key={metric.title}
            className="bg-card/50 backdrop-blur-sm border-border/50 hover:border-border/80 transition-all duration-300 bg-gradient-to-t from-primary/5 to-card"
          >
            <CardHeader>
              <CardDescription className="flex items-center gap-2">
                <IconComponent className="h-4 w-4 text-primary" />
                {metric.title}
              </CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {metric.value}
              </CardTitle>
              <CardAction>
                <Badge variant="outline" className="gap-1 bg-background/50">
                  {metric.trend !== "neutral" && <TrendIcon className="h-3 w-3" />}
                  {metric.badge}
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
              <div className="line-clamp-1 flex gap-2 font-medium items-center">
                {metric.footer}
                {metric.link && (
                  <a href={metric.link} target="_blank" rel="noopener noreferrer" className="transition-colors">
                    <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                  </a>
                )}
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

// Skeleton for Suspense fallback
export function MetricsOverviewSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <Card key={i} className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader>
            <div className="h-4 w-24 bg-muted/50 animate-pulse rounded" />
            <div className="h-8 w-16 mt-2 bg-muted/50 animate-pulse rounded" />
            <CardAction>
              <div className="h-5 w-16 bg-muted/30 animate-pulse rounded" />
            </CardAction>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5">
            <div className="h-4 w-32 bg-muted/30 animate-pulse rounded" />
            <div className="h-3 w-24 bg-muted/30 animate-pulse rounded" />
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}
