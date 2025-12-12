import { NextRequest, NextResponse } from "next/server"
import { verifyAdminAccess } from "@/lib/admin-api"
import { db } from "@/lib/db"

export async function GET(request: NextRequest) {
  const { isAdmin, response } = await verifyAdminAccess(request)
  if (!isAdmin) return response

  try {
    const result = await db.execute(`
      SELECT
        u.id as userId,
        u.email,
        u.plan,
        COALESCE(ul.analysesPerDay, 10) as analysesPerDay,
        COALESCE(ul.scriptsPerDay, 5) as scriptsPerDay,
        COALESCE(ul.cooldownHours, 0) as cooldownHours
      FROM users u
      LEFT JOIN user_limits ul ON u.id = ul.userId
      ORDER BY u.createdAt DESC
      LIMIT 500
    `)

    const limits = (result.rows || []).map((row: any) => ({
      userId: row.userId,
      email: row.email,
      plan: row.plan || "free",
      analysesPerDay: row.analysesPerDay,
      scriptsPerDay: row.scriptsPerDay,
      cooldownHours: row.cooldownHours,
    }))

    return NextResponse.json({ limits })
  } catch (error) {
    console.error("Error fetching limits:", error)
    return NextResponse.json(
      { error: "Failed to fetch limits" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  const { isAdmin, response } = await verifyAdminAccess(request)
  if (!isAdmin) return response

  try {
    const body = await request.json()
    const { userId, analysesPerDay, scriptsPerDay, cooldownHours } = body

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      )
    }

    const updatedAt = Math.floor(Date.now() / 1000)

    // Insert or update user_limits
    await db.execute(`
      INSERT OR REPLACE INTO user_limits
      (userId, analysesPerDay, scriptsPerDay, cooldownHours, updatedAt)
      VALUES (?, ?, ?, ?, ?)
    `, [
      userId,
      analysesPerDay ?? 10,
      scriptsPerDay ?? 5,
      cooldownHours ?? 0,
      updatedAt
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating limits:", error)
    return NextResponse.json(
      { error: "Failed to update limits" },
      { status: 500 }
    )
  }
}
