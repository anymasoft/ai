import { MetricsOverview } from "./components/metrics-overview"
import { MomentumTrendChart } from "./components/momentum-trend-chart"
import { PerformanceBreakdown } from "./components/performance-breakdown"
import { RecentVideos } from "./components/recent-videos"
import { TopVideosByMomentum } from "./components/top-videos-by-momentum"
import { ChannelInsightsTabs } from "./components/channel-insights-tabs"
import { YouTubeQuickActions } from "./components/youtube-quick-actions"

export default function Dashboard() {
  return (
    <div className="flex-1 space-y-6 px-6 pt-0">
      {/* Header */}
      <div className="flex md:flex-row flex-col md:items-center justify-between gap-4 md:gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">YouTube Analytics</h1>
          <p className="text-muted-foreground">
            Monitor competitor performance and discover trending content
          </p>
        </div>
        <YouTubeQuickActions />
      </div>

      {/* Main Dashboard Grid */}
      <div className="@container/main space-y-6">
        {/* Top Row - Key Metrics */}
        <MetricsOverview />

        {/* Second Row - Charts */}
        <div className="grid gap-6 grid-cols-1 xl:grid-cols-2">
          <MomentumTrendChart />
          <PerformanceBreakdown />
        </div>

        {/* Third Row - Video Lists */}
        <div className="grid gap-6 grid-cols-1 xl:grid-cols-2">
          <RecentVideos />
          <TopVideosByMomentum />
        </div>

        {/* Fourth Row - Channel Insights */}
        <ChannelInsightsTabs />
      </div>
    </div>
  )
}
