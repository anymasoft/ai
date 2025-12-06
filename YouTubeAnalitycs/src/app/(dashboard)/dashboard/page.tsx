import { Suspense } from "react"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { getDashboardKPI, getVideoPerformance } from "@/lib/dashboard-queries"

import { MetricsOverview, MetricsOverviewSkeleton } from "./components/metrics-overview"
import { MomentumTrendChart } from "./components/momentum-trend-chart"
import { PerformanceBreakdown } from "./components/performance-breakdown"
import { RecentVideos, RecentVideosSkeleton } from "./components/recent-videos"
import { TopVideosByMomentum, TopVideosByMomentumSkeleton } from "./components/top-videos-by-momentum"
import { ChannelInsightsTabs } from "./components/channel-insights-tabs"
import { YouTubeQuickActions } from "./components/youtube-quick-actions"

// Revalidate every 60 seconds
export const revalidate = 60

// Server Component for KPI data
async function KPISection() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return <MetricsOverview data={null} />
  }

  try {
    const kpiData = await getDashboardKPI(session.user.id)
    return <MetricsOverview data={kpiData} />
  } catch (error) {
    console.error("[Dashboard] Failed to fetch KPI:", error)
    return <MetricsOverview data={null} />
  }
}

// Server Component for Recent Videos
async function RecentVideosSection() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return <RecentVideos data={null} />
  }

  try {
    const videosData = await getVideoPerformance(session.user.id, "recent", 5)
    return <RecentVideos data={videosData} />
  } catch (error) {
    console.error("[Dashboard] Failed to fetch recent videos:", error)
    return <RecentVideos data={null} />
  }
}

// Server Component for Top Momentum Videos
async function TopMomentumSection() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return <TopVideosByMomentum data={null} />
  }

  try {
    const videosData = await getVideoPerformance(session.user.id, "momentum", 5)
    return <TopVideosByMomentum data={videosData} />
  } catch (error) {
    console.error("[Dashboard] Failed to fetch momentum videos:", error)
    return <TopVideosByMomentum data={null} />
  }
}

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
        {/* Top Row - Key Metrics (Server Component with Suspense) */}
        <Suspense fallback={<MetricsOverviewSkeleton />}>
          <KPISection />
        </Suspense>

        {/* Second Row - Charts (Client Components for interactivity) */}
        <div className="grid gap-6 grid-cols-1 xl:grid-cols-2">
          <MomentumTrendChart />
          <PerformanceBreakdown />
        </div>

        {/* Third Row - Video Lists (Server Components with Suspense) */}
        <div className="grid gap-6 grid-cols-1 xl:grid-cols-2">
          <Suspense fallback={<RecentVideosSkeleton />}>
            <RecentVideosSection />
          </Suspense>
          <Suspense fallback={<TopVideosByMomentumSkeleton />}>
            <TopMomentumSection />
          </Suspense>
        </div>

        {/* Fourth Row - Channel Insights (Client Component for tabs/charts) */}
        <ChannelInsightsTabs />
      </div>
    </div>
  )
}
