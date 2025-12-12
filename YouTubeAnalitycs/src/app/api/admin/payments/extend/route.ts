import { NextRequest, NextResponse } from "next/server"
import { verifyAdminAccess } from "@/lib/admin-api"
import { db } from "@/lib/db"

export async function POST(request: NextRequest) {
  const { isAdmin, response } = await verifyAdminAccess(request)
  if (!isAdmin) return response

  try {
    const body = await request.json()
    const { userId, days = 30 } = body

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      )
    }

    // Get current subscription
    const result = await db.execute(
      "SELECT expiresAt FROM admin_subscriptions WHERE userId = ?",
      [userId]
    )

    const row = (result.rows || [])[0]
    const currentExpiresAt = row?.expiresAt || 0

    // Calculate new expiration date
    const baseTime = Math.max(currentExpiresAt, Date.now())
    const newExpiresAt = baseTime + (days * 24 * 60 * 60 * 1000)
    const updatedAt = Math.floor(Date.now() / 1000)

    // Update subscription
    await db.execute(`
      INSERT OR REPLACE INTO admin_subscriptions
      (userId, plan, isPaid, expiresAt, provider, updatedAt)
      VALUES (?, COALESCE((SELECT plan FROM admin_subscriptions WHERE userId = ?), 'free'), 1, ?, 'manual', ?)
    `, [userId, userId, newExpiresAt, updatedAt])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error extending payment:", error)
    return NextResponse.json(
      { error: "Failed to extend payment" },
      { status: 500 }
    )
  }
}
