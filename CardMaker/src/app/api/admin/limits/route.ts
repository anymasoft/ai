import { NextRequest, NextResponse } from "next/server"
import { verifyAdminAccess } from "@/lib/admin-api"
import { db } from "@/lib/db"
import { getMonthlyScriptLimit } from "@/config/plan-limits"

export async function GET(request: NextRequest) {
  const { isAdmin, response } = await verifyAdminAccess(request)
  if (!isAdmin) return response

  try {
    // Get all users and their current plans
    const result = await db.execute(
      `SELECT
        u.id as userId,
        u.email,
        u.plan
      FROM users u
      ORDER BY u.createdAt DESC
      LIMIT 500`
    )

    const rows = Array.isArray(result) ? result : result.rows || []

    // Get monthly usage for each user
    const today = new Date()
    const monthPrefix = today.toISOString().slice(0, 7) // YYYY-MM

    const usages = await Promise.all(
      rows.map(async (row: any) => {
        const plan = row.plan || "free"
        const monthlyLimit = getMonthlyScriptLimit(plan as any)

        // Get usage for current month
        const usageResult = await db.execute(
          `SELECT COALESCE(SUM(cardsUsed), 0) as totalUsed
           FROM user_usage_daily
           WHERE userId = ? AND day LIKE ?`,
          [row.userId, monthPrefix + '%']
        )

        const usageRows = Array.isArray(usageResult) ? usageResult : usageResult.rows || []
        const monthlyUsed = usageRows[0]?.totalUsed || 0
        const monthlyRemaining = Math.max(0, monthlyLimit - monthlyUsed)
        const percentageUsed = monthlyLimit > 0 ? Math.round((monthlyUsed / monthlyLimit) * 100) : 0

        return {
          userId: row.userId,
          email: row.email,
          plan,
          monthlyLimit,
          monthlyUsed,
          monthlyRemaining,
          percentageUsed,
        }
      })
    )

    return NextResponse.json({ usages })
  } catch (error) {
    console.error("Error fetching usage:", error)
    return NextResponse.json(
      { error: "Failed to fetch usage" },
      { status: 500 }
    )
  }
}
