import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db, competitors } from "@/lib/db"
import { eq } from "drizzle-orm"
import { MetricsOverview } from "./components/metrics-overview"
import { SalesChart } from "./components/sales-chart"
import { RecentTransactions } from "./components/recent-transactions"
import { TopProducts } from "./components/top-products"
import { CustomerInsights } from "./components/customer-insights"
import { QuickActions } from "./components/quick-actions"
import { RevenueBreakdown } from "./components/revenue-breakdown"

export default async function Dashboard2() {
  const session = await getServerSession(authOptions)

  let competitorStats = {
    totalCompetitors: 0,
    totalSubscribers: 0,
    totalViews: 0,
    totalVideos: 0,
  }

  if (session?.user?.id) {
    try {
      const userCompetitors = await db
        .select()
        .from(competitors)
        .where(eq(competitors.userId, session.user.id))
        .all()

      competitorStats = {
        totalCompetitors: userCompetitors.length,
        totalSubscribers: userCompetitors.reduce((sum, c) => sum + c.subscriberCount, 0),
        totalViews: userCompetitors.reduce((sum, c) => sum + c.viewCount, 0),
        totalVideos: userCompetitors.reduce((sum, c) => sum + c.videoCount, 0),
      }
    } catch (error) {
      console.error("Failed to fetch competitor stats:", error)
    }
  }

  return (
    <div className="flex-1 space-y-6 px-6 pt-0">
        {/* Enhanced Header */}

        <div className="flex md:flex-row flex-col md:items-center justify-between gap-4 md:gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Business Dashboard</h1>
            <p className="text-muted-foreground">
              Monitor your business performance and key metrics in real-time
            </p>
          </div>
          <QuickActions />
        </div>

        {/* Main Dashboard Grid */}
        <div className="@container/main space-y-6">
          {/* Top Row - Key Metrics */}

          <MetricsOverview stats={competitorStats} />

          {/* Second Row - Charts in 6-6 columns */}
          <div className="grid gap-6 grid-cols-1 @5xl:grid-cols-2">
            <SalesChart />
            <RevenueBreakdown />
          </div>

          {/* Third Row - Two Column Layout */}
          <div className="grid gap-6 grid-cols-1 @5xl:grid-cols-2">
            <RecentTransactions />
            <TopProducts />
          </div>

          {/* Fourth Row - Customer Insights and Team Performance */}
          <CustomerInsights />
        </div>
      </div>
  )
}
