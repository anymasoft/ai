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
    <Card className="h-fit">
      <CardHeader>
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-48" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-10 w-full mb-6" />
        <Skeleton className="h-[350px] w-full" />
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
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Channel Insights</CardTitle>
          <CardDescription className="text-destructive">{error}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (!data || data.channels.length === 0) {
    return (
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Channel Insights
          </CardTitle>
          <CardDescription>No channel data available</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            Add competitors to see channel insights
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
      label: "Avg Views/Video",
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
      label: "Videos/Month",
      color: "hsl(var(--chart-2))",
    },
  }

  return (
    <Card className="h-fit">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Channel Insights
          </CardTitle>
          <CardDescription>
            Competitor performance and growth analysis
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
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-muted/50 p-1 rounded-lg h-12 mb-6">
            <TabsTrigger
              value="growth"
              className="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Growth</span>
            </TabsTrigger>
            <TabsTrigger
              value="engagement"
              className="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Engagement</span>
            </TabsTrigger>
            <TabsTrigger
              value="upload"
              className="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Uploads</span>
            </TabsTrigger>
          </TabsList>

          {/* Growth Tab - Line Chart */}
          <TabsContent value="growth" className="space-y-6">
            <div className="grid grid-cols-10 gap-6">
              {/* Chart Area */}
              <div className="col-span-10 xl:col-span-7">
                <h3 className="text-sm font-medium text-muted-foreground mb-4">Subscriber Growth</h3>
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
                    No historical data available for this period
                  </div>
                )}
              </div>

              {/* Channel Cards */}
              <div className="col-span-10 xl:col-span-3 space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground mb-4">Channels</h3>
                {data.channels.slice(0, 4).map((channel, index) => (
                  <div
                    key={channel.channelId}
                    className="p-3 rounded-lg border flex items-center gap-3"
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
            <h3 className="text-sm font-medium text-muted-foreground">Average Views per Video</h3>
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
            <h3 className="text-sm font-medium text-muted-foreground">Upload Frequency (videos per month)</h3>
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
                        `${value} videos/month`,
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
            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Average upload frequency across all channels:{" "}
                <span className="font-semibold text-foreground">
                  {data.summary.avgUploadFrequency} videos/month
                </span>
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
