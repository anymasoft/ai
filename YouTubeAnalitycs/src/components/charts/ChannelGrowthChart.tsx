"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ChannelMetric {
  id: number;
  userId: string;
  channelId: string;
  subscriberCount: number;
  videoCount: number;
  viewCount: number;
  date: string;
  fetchedAt: number;
}

interface ChannelGrowthChartProps {
  metrics: ChannelMetric[];
  title?: string;
  description?: string;
}

/**
 * Форматирует числа для оси Y (1000000 => 1M)
 */
function formatYAxis(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toString();
}

/**
 * Форматирует дату для оси X (2025-01-15 => 15 Jan)
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const day = date.getDate();
  const month = date.toLocaleString("en-US", { month: "short" });
  return `${day} ${month}`;
}

/**
 * Форматирует число с разделителями тысяч
 */
function formatNumber(num: number): string {
  return new Intl.NumberFormat("en-US").format(num);
}

/**
 * Custom tooltip для детального отображения данных
 */
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-background border rounded-lg p-3 shadow-lg">
      <p className="font-semibold mb-2">{formatDate(label)}</p>
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-semibold">{formatNumber(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function ChannelGrowthChart({
  metrics,
  title = "Growth Over Time",
  description = "Historical metrics for this channel",
}: ChannelGrowthChartProps) {
  // Если данных нет или меньше 2 точек
  if (!metrics || metrics.length < 2) {
    const dataPoints = metrics?.length || 0;
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <div className="text-center max-w-md">
              <p className="text-lg font-semibold mb-3">
                Insufficient data for chart ({dataPoints}/2 data points)
              </p>
              <p className="text-sm mb-4">
                Click "Sync Metrics" button {dataPoints === 0 ? "twice" : "one more time"} to collect enough data for growth trends.
              </p>
              <p className="text-xs text-muted-foreground">
                Note: Only one sync per day is allowed. Come back tomorrow for the second data point, or sync multiple times today for testing.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Сортируем метрики по дате
  const sortedMetrics = [...metrics].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={sortedMetrics}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                className="text-xs"
              />
              <YAxis tickFormatter={formatYAxis} className="text-xs" />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line
                type="monotone"
                dataKey="subscriberCount"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ fill: "#3b82f6", r: 4 }}
                activeDot={{ r: 6 }}
                name="Subscribers"
              />
              <Line
                type="monotone"
                dataKey="viewCount"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ fill: "#10b981", r: 4 }}
                activeDot={{ r: 6 }}
                name="Total Views"
              />
              <Line
                type="monotone"
                dataKey="videoCount"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={{ fill: "#f59e0b", r: 4 }}
                activeDot={{ r: 6 }}
                name="Videos"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
