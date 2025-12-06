"use client"

import { useEffect, useState } from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
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
    label: "Avg Momentum",
    color: "hsl(var(--primary))",
  },
  highMomentumCount: {
    label: "High Momentum Videos",
    color: "hsl(var(--chart-2))",
  },
}

function ChartSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-9 w-32" />
      </CardHeader>
      <CardContent className="p-0 pt-6">
        <div className="px-6 pb-6">
          <Skeleton className="h-[350px] w-full" />
        </div>
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
      <Card>
        <CardHeader>
          <CardTitle>Momentum Trend</CardTitle>
          <CardDescription className="text-destructive">{error}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (!data || data.trend.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Momentum Trend
          </CardTitle>
          <CardDescription>No momentum data available yet</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[350px] text-muted-foreground">
            Add competitors and sync videos to see momentum trends
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
    ? "text-green-600"
    : data.summary.highMomentumVideosTrend === "down"
      ? "text-red-600"
      : "text-muted-foreground"

  // Format dates for display
  const chartData = data.trend.map(point => ({
    ...point,
    displayDate: new Date(point.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
  }))

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Momentum Trend
          </CardTitle>
          <CardDescription className="flex items-center gap-2 mt-1">
            <span>Video performance dynamics</span>
            <Badge variant="outline" className={`gap-1 ${trendColor}`}>
              <TrendIcon className="h-3 w-3" />
              {data.summary.highMomentumVideosTrend}
            </Badge>
          </CardDescription>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="p-0 pt-6">
        <div className="px-6 pb-4 flex gap-6 text-sm">
          <div>
            <span className="text-muted-foreground">High Momentum Videos:</span>{" "}
            <span className="font-semibold">{data.summary.totalHighMomentumVideos}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Median Views/Day:</span>{" "}
            <span className="font-semibold">{data.summary.medianViewsPerDay.toLocaleString()}</span>
          </div>
        </div>
        <div className="px-6 pb-6">
          <ChartContainer config={chartConfig} className="h-[350px] w-full">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorMomentum" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="colorHighMomentum" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
              <XAxis
                dataKey="displayDate"
                axisLine={false}
                tickLine={false}
                className="text-xs"
                tick={{ fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                className="text-xs"
                tick={{ fontSize: 11 }}
                tickFormatter={(value) => `${value > 0 ? "+" : ""}${(value * 100).toFixed(0)}%`}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value, name) => {
                      if (name === "avgMomentum") {
                        return [`${((value as number) * 100).toFixed(1)}%`, "Avg Momentum"]
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
                fill="url(#colorMomentum)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        </div>
      </CardContent>
    </Card>
  )
}
