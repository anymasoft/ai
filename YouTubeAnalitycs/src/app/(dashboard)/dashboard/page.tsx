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
import { DashboardHeader } from "./components/dashboard-header"
import { DashboardEmptyState } from "./components/dashboard-empty-state"

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
  return <RecentVideos />
}

// Server Component for Top Momentum Videos
async function TopMomentumSection() {
  return <TopVideosByMomentum />
}

// Check if user has any data
async function hasData(): Promise<boolean> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return false

  try {
    const kpiData = await getDashboardKPI(session.user.id)
    return kpiData.totalCompetitors > 0
  } catch {
    return false
  }
}

export default async function Dashboard() {
  const hasUserData = await hasData()

  // Show empty state if no competitors
  if (!hasUserData) {
    return (
      <div className="flex-1 px-4 sm:px-6 lg:px-8 py-6">
        <DashboardEmptyState />
      </div>
    )
  }

  return (
    <div className="flex-1 px-4 sm:px-6 lg:px-8 py-6 space-y-8" data-dashboard-content>
      {/* Header with date filter and actions */}
      <DashboardHeader />

      {/* Main Dashboard Grid */}
      <div className="space-y-8">
        {/* Top Row - Key Metrics */}
        <section>
          <Suspense fallback={<MetricsOverviewSkeleton />}>
            <KPISection />
          </Suspense>
        </section>

        {/* Second Row - Charts */}
        <section className="grid gap-6 grid-cols-1 lg:grid-cols-2">
          <MomentumTrendChart />
          <PerformanceBreakdown />
        </section>

        {/* Third Row - Video Lists */}
        <section className="grid gap-6 grid-cols-1 lg:grid-cols-2">
          <Suspense fallback={<RecentVideosSkeleton />}>
            <RecentVideosSection />
          </Suspense>
          <Suspense fallback={<TopVideosByMomentumSkeleton />}>
            <TopMomentumSection />
          </Suspense>
        </section>

        {/* Fourth Row - Аналитика канала */}
        <section>
          <ChannelInsightsTabs />
        </section>
      </div>
    </div>
  )
}
