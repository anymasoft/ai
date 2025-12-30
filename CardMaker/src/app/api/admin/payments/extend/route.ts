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

    // Get current subscription from users table
    const result = await db.execute(
      "SELECT expiresAt FROM users WHERE id = ?",
      [userId]
    )

    const row = Array.isArray(result) ? result[0] : (result.rows || [])[0]
    let currentExpiresAt = row?.expiresAt || 0

    // Защита от старых значений в БД: если expiresAt в секундах (< 10^12), конвертируем
    if (currentExpiresAt && currentExpiresAt < 1_000_000_000_000) {
      currentExpiresAt = currentExpiresAt * 1000
    }

    // Calculate new expiration date (в миллисекундах)
    const baseTime = Math.max(currentExpiresAt, Date.now())
    const newExpiresAt = baseTime + (days * 24 * 60 * 60 * 1000)
    const updatedAt = Date.now()

    // Update users table (ONLY source of truth)
    await db.execute(
      "UPDATE users SET expiresAt = ?, updatedAt = ? WHERE id = ?",
      [newExpiresAt, updatedAt, userId]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error extending payment:", error)
    return NextResponse.json(
      { error: "Failed to extend payment" },
      { status: 500 }
    )
  }
}
