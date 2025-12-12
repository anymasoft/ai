import { NextRequest, NextResponse } from "next/server"
import { verifyAdminAccess } from "@/lib/admin-api"
import { db } from "@/lib/db"

export async function POST(request: NextRequest) {
  const { isAdmin, response } = await verifyAdminAccess(request)
  if (!isAdmin) return response

  try {
    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      )
    }

    const today = new Date().toISOString().split("T")[0]

    // Reset today's usage
    await db.execute(
      "DELETE FROM user_usage_daily WHERE userId = ? AND day = ?",
      [userId, today]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error resetting usage:", error)
    return NextResponse.json(
      { error: "Failed to reset usage" },
      { status: 500 }
    )
  }
}
