"use client"

import { useEffect, useState } from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, Minus, Zap } from "lucide-react"

interface TrendDataPoint {
  date: string
  avgMomentum: number
  highMomentumCount: number
  totalVideos: number
}

interface MomentumTrendData {
  period: number
  trend: TrendDataPoint[]
  summary: {
    avgMomentumChange: number
    highMomentumVideosTrend: "up" | "down" | "stable"
    totalHighMomentumVideos: number
    medianViewsPerDay: number
  }
}

const chartConfig = {
  avgMomentum: {
    label: "Средний темп роста",
    color: "hsl(var(--primary))",
  },
}

function ChartSkeleton() {
  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0 pb-3">
        <div className="space-y-2">
          <div className="h-5 w-32 bg-muted/50 animate-pulse rounded" />
          <div className="h-4 w-48 bg-muted/30 animate-pulse rounded" />
        </div>
        <div className="h-8 w-[130px] bg-muted/50 animate-pulse rounded" />
      </CardHeader>
      <CardContent className="pt-2">
        <div className="flex gap-8 mb-4">
          <div className="space-y-1">
            <div className="h-3 w-20 bg-muted/30 animate-pulse rounded" />
            <div className="h-6 w-12 bg-muted/50 animate-pulse rounded" />
          </div>
          <div className="space-y-1">
            <div className="h-3 w-24 bg-muted/30 animate-pulse rounded" />
            <div className="h-6 w-16 bg-muted/50 animate-pulse rounded" />
          </div>
        </div>
        <div className="h-[280px] w-full bg-gradient-to-b from-muted/20 to-transparent animate-pulse rounded-lg" />
      </CardContent>
    </Card>
  )
}

export function MomentumTrendChart() {
  const [data, setData] = useState<MomentumTrendData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<string>("30")

  useEffect(() => {
    async function fetchTrend() {
      setLoading(true)
      try {
        const response = await fetch(`/api/dashboard/momentum-trend?period=${period}`)
        if (!response.ok) {
          throw new Error("Failed to fetch momentum trend")
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

    fetchTrend()
  }, [period])

  if (loading) {
    return <ChartSkeleton />
  }

  if (error) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Zap className="h-5 w-5" />
            Динамика роста
          </CardTitle>
          <CardDescription className="text-destructive">{error}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (!data || data.trend.length === 0) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Zap className="h-5 w-5" />
            Тренд Momentum
          </CardTitle>
          <CardDescription>Данные о momentum еще не доступны</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-[280px] text-muted-foreground">
            <Zap className="h-12 w-12 mb-4 opacity-20" />
            <p className="text-sm text-center">Добавьте конкурентов и синхронизируйте видео для просмотра трендов</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const TrendIcon = data.summary.highMomentumVideosTrend === "up"
    ? TrendingUp
    : data.summary.highMomentumVideosTrend === "down"
      ? TrendingDown
      : Minus

  const trendColor = data.summary.highMomentumVideosTrend === "up"
    ? "text-emerald-500"
    : data.summary.highMomentumVideosTrend === "down"
      ? "text-red-500"
      : "text-muted-foreground"

  // Format dates for display
  const chartData = data.trend.map(point => ({
    ...point,
    displayDate: new Date(point.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }))

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50 hover:border-border/80 transition-colors duration-300">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0 pb-3">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <Zap className="h-5 w-5 text-primary" />
            Динамика роста
          </CardTitle>
          <CardDescription className="flex items-center gap-2 text-sm">
            <span>Динамика просмотров видео</span>
            <Badge variant="outline" className={`gap-1 text-xs ${trendColor}`}>
              <TrendIcon className="h-3 w-3" />
              {data.summary.highMomentumVideosTrend === "up" ? "растет" : data.summary.highMomentumVideosTrend === "down" ? "падает" : "стабильно"}
            </Badge>
          </CardDescription>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[130px] h-8 text-sm bg-background/50 border-border/50 hover:border-border transition-colors">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 дней</SelectItem>
            <SelectItem value="30">30 дней</SelectItem>
            <SelectItem value="90">90 дней</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="pt-2">
        {/* Stats Row */}
        <div className="flex flex-wrap gap-6 sm:gap-10 mb-5">
          <div className="space-y-0.5">
            <p className="text-muted-foreground text-xs uppercase tracking-wider">Быстрый рост</p>
            <p className="text-2xl font-semibold tabular-nums">{data.summary.totalHighMomentumVideos}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-muted-foreground text-xs uppercase tracking-wider">Медиана просмотров/день</p>
            <p className="text-2xl font-semibold tabular-nums">{data.summary.medianViewsPerDay.toLocaleString()}</p>
          </div>
        </div>

        {/* Chart */}
        <ChartContainer config={chartConfig} className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="momentumGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                strokeOpacity={0.4}
                vertical={false}
              />
              <XAxis
                dataKey="displayDate"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                interval="preserveStartEnd"
                tickMargin={8}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={(value) => `${value > 0 ? "+" : ""}${(value * 100).toFixed(0)}%`}
                width={48}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => {
                      if (name === "avgMomentum") {
                        return [`${((value as number) * 100).toFixed(1)}%`, "Средний темп роста"]
                      }
                      return [value, name]
                    }}
                  />
                }
              />
              <Area
                type="monotone"
                dataKey="avgMomentum"
                stroke="hsl(var(--primary))"
                fill="url(#momentumGradient)"
                strokeWidth={2}
                animationDuration={750}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
