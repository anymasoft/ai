"use client"

import { useEffect, useState } from "react"
import { Label, Pie, PieChart, Sector } from "recharts"
import type { PieSectorDataItem } from "recharts/types/polar/Pie"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartStyle, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Lightbulb, TrendingUp, Video } from "lucide-react"

interface ThemeItem {
  theme: string
  count: number
}

interface FormatItem {
  format: string
  count: number
}

interface ThemesData {
  aggregated: {
    topThemes: ThemeItem[]
    topFormats: FormatItem[]
    allRecommendations: string[]
    latestSummary: string | null
    sources: {
      trendingInsights: number
      momentumInsights: number
    }
  }
  latest: {
    themes: string[]
    formats: string[]
    recommendations: string[]
    summary: string
    generatedAt: number
    videoCount: number
  } | null
  hasData: boolean
}

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
]

function ChartSkeleton() {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-56 mt-1" />
      </CardHeader>
      <CardContent className="flex flex-1 justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
          <div className="flex justify-center">
            <Skeleton className="aspect-square w-full max-w-[250px] rounded-full" />
          </div>
          <div className="flex flex-col justify-center space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function PerformanceBreakdown() {
  const id = "performance-breakdown"
  const [data, setData] = useState<ThemesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    async function fetchThemes() {
      try {
        const response = await fetch("/api/dashboard/themes")
        if (!response.ok) {
          throw new Error("Failed to fetch themes data")
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

    fetchThemes()
  }, [])

  if (loading) {
    return <ChartSkeleton />
  }

  if (error) {
    return (
      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle>Content Themes</CardTitle>
          <CardDescription className="text-destructive">{error}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (!data || !data.hasData) {
    return (
      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Content Themes
          </CardTitle>
          <CardDescription>No theme data available yet</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-muted-foreground text-center">
            <div>
              <p>Generate trend analysis to see content themes</p>
              <p className="text-sm mt-2">Go to Trending page and analyze videos</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Prepare chart data from top themes
  const chartData = data.aggregated.topThemes.slice(0, 5).map((item, index) => ({
    name: item.theme,
    value: item.count,
    fill: COLORS[index % COLORS.length],
  }))

  const chartConfig = chartData.reduce((acc, item, index) => {
    acc[item.name] = {
      label: item.name,
      color: COLORS[index % COLORS.length],
    }
    return acc
  }, {} as Record<string, { label: string; color: string }>)

  const totalCount = chartData.reduce((sum, item) => sum + item.value, 0)

  return (
    <Card data-chart={id} className="flex flex-col">
      <ChartStyle id={id} config={chartConfig} />
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5" />
          Content Themes
        </CardTitle>
        <CardDescription className="flex items-center gap-2">
          <span>Top performing content topics</span>
          <Badge variant="outline" className="text-xs">
            {data.aggregated.sources.trendingInsights + data.aggregated.sources.momentumInsights} analyses
          </Badge>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 pb-0">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
          {/* Pie Chart */}
          <div className="flex justify-center items-center">
            <ChartContainer
              id={id}
              config={chartConfig}
              className="mx-auto aspect-square w-full max-w-[250px]"
            >
              <PieChart>
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideLabel />}
                />
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={80}
                  strokeWidth={4}
                  activeIndex={activeIndex}
                  activeShape={({
                    outerRadius = 0,
                    ...props
                  }: PieSectorDataItem) => (
                    <g>
                      <Sector {...props} outerRadius={outerRadius + 8} />
                      <Sector
                        {...props}
                        outerRadius={outerRadius + 20}
                        innerRadius={outerRadius + 10}
                      />
                    </g>
                  )}
                >
                  <Label
                    content={({ viewBox }) => {
                      if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                        return (
                          <text
                            x={viewBox.cx}
                            y={viewBox.cy}
                            textAnchor="middle"
                            dominantBaseline="middle"
                          >
                            <tspan
                              x={viewBox.cx}
                              y={viewBox.cy}
                              className="fill-foreground text-2xl font-bold"
                            >
                              {totalCount}
                            </tspan>
                            <tspan
                              x={viewBox.cx}
                              y={(viewBox.cy || 0) + 20}
                              className="fill-muted-foreground text-xs"
                            >
                              mentions
                            </tspan>
                          </text>
                        )
                      }
                    }}
                  />
                </Pie>
              </PieChart>
            </ChartContainer>
          </div>

          {/* Theme List */}
          <div className="flex flex-col justify-center space-y-2">
            {chartData.map((item, index) => (
              <div
                key={item.name}
                className={`flex items-center justify-between p-3 rounded-lg transition-colors cursor-pointer ${
                  index === activeIndex ? "bg-muted" : "hover:bg-muted/50"
                }`}
                onClick={() => setActiveIndex(index)}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: item.fill }}
                  />
                  <span className="font-medium text-sm line-clamp-1">{item.name}</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{item.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>

      {/* Bottom section with formats and recommendations */}
      <div className="px-6 py-4 border-t mt-4">
        <div className="space-y-3">
          {data.aggregated.topFormats.length > 0 && (
            <div className="flex items-start gap-2">
              <Video className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <div className="flex flex-wrap gap-1.5">
                {data.aggregated.topFormats.slice(0, 4).map((format) => (
                  <Badge key={format.format} variant="secondary" className="text-xs">
                    {format.format}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {data.aggregated.allRecommendations.length > 0 && (
            <div className="flex items-start gap-2">
              <TrendingUp className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <p className="text-sm text-muted-foreground line-clamp-2">
                {data.aggregated.allRecommendations[0]}
              </p>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
