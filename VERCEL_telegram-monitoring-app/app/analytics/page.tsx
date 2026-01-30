"use client"

import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartAreaInteractive } from "@/components/chart-area-interactive"
import { Badge } from "@/components/ui/badge"
import { IconTrendingUp, IconTrendingDown, IconChartBar } from "@tabler/icons-react"

const analyticsData = [
  { date: "2024-01-01", mentions: 45, channels: 12, sentiment: 0.6 },
  { date: "2024-01-02", mentions: 52, channels: 15, sentiment: 0.7 },
  { date: "2024-01-03", mentions: 38, channels: 11, sentiment: 0.5 },
  { date: "2024-01-04", mentions: 67, channels: 18, sentiment: 0.8 },
  { date: "2024-01-05", mentions: 89, channels: 22, sentiment: 0.6 },
  { date: "2024-01-06", mentions: 76, channels: 19, sentiment: 0.7 },
  { date: "2024-01-07", mentions: 94, channels: 24, sentiment: 0.9 },
]

export default function AnalyticsPage() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <div className="@container/main">
            <div className="p-6 space-y-6">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Аналитика</h1>
                <p className="text-muted-foreground">Детальная аналитика и статистика мониторинга Telegram каналов</p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <ChartAreaInteractive
                  data={analyticsData}
                  title="Динамика упоминаний"
                  description="Изменение количества упоминаний по дням"
                />

                <Card>
                  <CardHeader>
                    <CardTitle>Топ ключевые слова</CardTitle>
                    <CardDescription>Самые популярные ключевые слова за период</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {[
                        { word: "искусственный интеллект", count: 89, trend: "up" },
                        { word: "стартап", count: 67, trend: "up" },
                        { word: "инвестиции", count: 45, trend: "down" },
                        { word: "биткоин", count: 23, trend: "up" },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{item.word}</p>
                            <p className="text-sm text-muted-foreground">{item.count} упоминаний</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {item.trend === "up" ? (
                              <IconTrendingUp className="h-4 w-4 text-green-600" />
                            ) : (
                              <IconTrendingDown className="h-4 w-4 text-red-600" />
                            )}
                            <Badge variant="outline">{item.count}</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="text-center py-12">
                <CardContent>
                  <IconChartBar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Расширенная аналитика</h3>
                  <p className="text-muted-foreground">Здесь будут размещены дополнительные графики и отчеты</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
