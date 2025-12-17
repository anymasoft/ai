"use client"

import { useEffect, useState } from "react"
import { Line, LineChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, BarChart3, Upload, Users, ArrowUpIcon, ArrowDownIcon } from "lucide-react"
import { ChannelAvatar } from "@/components/channel-avatar"

interface ChannelData {
  channelId: string
  handle: string
  title: string
  avatarUrl: string | null
  currentSubscribers: number
  currentViews: number
  currentVideos: number
  avgViewsPerVideo: number
  uploadFrequency: number
  subscribersHistory: Array<{
    date: string
    subscribers: number
  }>
  growth7d: number | null
  growth30d: number | null
  lastSyncedAt: number
}

interface ChannelGrowthData {
  channels: ChannelData[]
  period: number
  summary: {
    totalChannels: number
    totalSubscribers: number
    avgUploadFrequency: number
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

function ChartSkeleton() {
  return (
    <Card className="h-fit bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader>
        <Skeleton className="h-5 w-32 bg-muted/50" />
        <Skeleton className="h-4 w-48 bg-muted/30" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-10 w-full mb-6 bg-muted/30" />
        <Skeleton className="h-[350px] w-full bg-gradient-to-b from-muted/20 to-transparent" />
      </CardContent>
    </Card>
  )
}

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
]

export function ChannelInsightsTabs() {
  const [data, setData] = useState<ChannelGrowthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState("30")
  const [activeTab, setActiveTab] = useState("growth")

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const response = await fetch(`/api/dashboard/channel-growth?period=${period}`)
        if (!response.ok) {
          throw new Error("Failed to fetch channel data")
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

    fetchData()
  }, [period])

  if (loading) {
    return <ChartSkeleton />
  }

  if (error) {
    return (
      <Card className="h-fit bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5" />
            Аналитика канала
          </CardTitle>
          <CardDescription className="text-destructive">{error}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (!data || data.channels.length === 0) {
    return (
      <Card className="h-fit bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5" />
            Аналитика канала
          </CardTitle>
          <CardDescription>Данных о каналах нет</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
            <BarChart3 className="h-12 w-12 mb-4 opacity-20" />
            <p className="text-sm text-center">Добавьте конкурентов для просмотра аналитики</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Prepare chart data for subscribers growth (line chart)
  // Combine all channels' history into unified timeline
  const allDates = new Set<string>()
  data.channels.forEach(channel => {
    channel.subscribersHistory.forEach(h => allDates.add(h.date))
  })

  const sortedDates = Array.from(allDates).sort()
  const growthChartData = sortedDates.map(date => {
    const dataPoint: Record<string, any> = {
      date,
      displayDate: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    }

    data.channels.forEach(channel => {
      const historyPoint = channel.subscribersHistory.find(h => h.date === date)
      dataPoint[channel.channelId] = historyPoint?.subscribers || null
    })

    return dataPoint
  })

  // Prepare chart config for growth chart
  const growthChartConfig = data.channels.reduce((acc, channel, index) => {
    acc[channel.channelId] = {
      label: channel.title,
      color: COLORS[index % COLORS.length],
    }
    return acc
  }, {} as Record<string, { label: string; color: string }>)

  // Prepare data for engagement bar chart (avgViewsPerVideo)
  const engagementChartData = data.channels.map(channel => ({
    name: channel.title.length > 15 ? channel.title.slice(0, 15) + "..." : channel.title,
    fullName: channel.title,
    avgViews: channel.avgViewsPerVideo,
    uploadFreq: channel.uploadFrequency,
  }))

  const engagementChartConfig = {
    avgViews: {
      label: "Среднее кол-во просмотров/видео",
      color: "hsl(var(--primary))",
    },
  }

  // Prepare data for upload frequency
  const uploadChartData = data.channels.map(channel => ({
    name: channel.title.length > 15 ? channel.title.slice(0, 15) + "..." : channel.title,
    fullName: channel.title,
    frequency: channel.uploadFrequency,
  }))

  const uploadChartConfig = {
    frequency: {
      label: "Видео в месяц",
      color: "hsl(var(--chart-2))",
    },
  }

  return (
    <Card className="h-fit bg-card/50 backdrop-blur-sm border-border/50 hover:border-border/80 transition-colors duration-300">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <BarChart3 className="h-5 w-5 text-primary" />
            Аналитика канала
          </CardTitle>
          <CardDescription className="text-sm">
            Анализ роста и эффективности конкурентов
          </CardDescription>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-32 bg-background/50 border-border/50 hover:border-border transition-colors">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 дней</SelectItem>
            <SelectItem value="30">30 дней</SelectItem>
            <SelectItem value="90">90 дней</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-muted/30 p-1 rounded-lg h-12 mb-6 border border-border/30">
            <TabsTrigger
              value="growth"
              className="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Рост</span>
            </TabsTrigger>
            <TabsTrigger
              value="engagement"
              className="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Вовлечённость</span>
            </TabsTrigger>
            <TabsTrigger
              value="upload"
              className="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Загрузки</span>
            </TabsTrigger>
          </TabsList>

          {/* Growth Tab - Line Chart */}
          <TabsContent value="growth" className="space-y-6">
            <div className="grid grid-cols-10 gap-6">
              {/* Chart Area */}
              <div className="col-span-10 xl:col-span-7">
                <h3 className="text-sm font-medium text-muted-foreground mb-4">Рост подписчиков</h3>
                {growthChartData.length > 0 ? (
                  <ChartContainer config={growthChartConfig} className="h-[350px] w-full">
                    <LineChart data={growthChartData} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
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
                        tickFormatter={(value) => formatNumber(value)}
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      {data.channels.map((channel, index) => (
                        <Line
                          key={channel.channelId}
                          type="monotone"
                          dataKey={channel.channelId}
                          name={channel.title}
                          stroke={COLORS[index % COLORS.length]}
                          strokeWidth={2}
                          dot={false}
                          connectNulls
                        />
                      ))}
                    </LineChart>
                  </ChartContainer>
                ) : (
                  <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                    Нет исторических данных за этот период
                  </div>
                )}
              </div>

              {/* Channel Cards */}
              <div className="col-span-10 xl:col-span-3 space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground mb-4">Channels</h3>
                {data.channels.slice(0, 4).map((channel, index) => (
                  <div
                    key={channel.channelId}
                    className="p-3 rounded-lg border border-border/50 flex items-center gap-3 hover:bg-muted/30 hover:border-border/80 transition-all duration-200"
                  >
                    <div
                      className="w-1 h-10 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <ChannelAvatar
                      src={channel.avatarUrl}
                      alt={channel.title}
                      className="h-8 w-8"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{channel.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatNumber(channel.currentSubscribers)} subs
                      </p>
                    </div>
                    {channel.growth7d !== null && (
                      <Badge
                        variant={channel.growth7d >= 0 ? "outline" : "destructive"}
                        className="gap-1 shrink-0"
                      >
                        {channel.growth7d >= 0 ? (
                          <ArrowUpIcon className="h-3 w-3" />
                        ) : (
                          <ArrowDownIcon className="h-3 w-3" />
                        )}
                        {channel.growth7d >= 0 ? "+" : ""}{formatNumber(channel.growth7d)}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Engagement Tab - Bar Chart */}
          <TabsContent value="engagement" className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Среднее число просмотров на видео</h3>
            <ChartContainer config={engagementChartConfig} className="h-[350px] w-full">
              <BarChart data={engagementChartData} margin={{ top: 20, right: 20, bottom: 60, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  className="text-xs"
                  tick={{ fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  className="text-xs"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) => formatNumber(value)}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name, item) => [
                        formatNumber(value as number),
                        item.payload.fullName
                      ]}
                    />
                  }
                />
                <Bar
                  dataKey="avgViews"
                  fill="hsl(var(--primary))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </TabsContent>

          {/* Upload Frequency Tab - Bar Chart */}
          <TabsContent value="upload" className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground">Частота публикаций (видео в месяц)</h3>
            <ChartContainer config={uploadChartConfig} className="h-[350px] w-full">
              <BarChart data={uploadChartData} margin={{ top: 20, right: 20, bottom: 60, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted/30" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  className="text-xs"
                  tick={{ fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  className="text-xs"
                  tick={{ fontSize: 11 }}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name, item) => [
                        `${value} видео в месяц`,
                        item.payload.fullName
                      ]}
                    />
                  }
                />
                <Bar
                  dataKey="frequency"
                  fill="hsl(var(--chart-2))"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>

            {/* Summary */}
            <div className="pt-4 border-t border-border/50">
              <p className="text-sm text-muted-foreground">
                В среднем по всем каналам публикуется{" "}
                <span className="font-semibold text-foreground tabular-nums">
                  {data.summary.avgUploadFrequency}
                </span>
                {" "}видео в месяц
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
