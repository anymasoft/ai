import { NextRequest, NextResponse } from "next/server"
import { verifyAdminAccess } from "@/lib/admin-api"
import { db } from "@/lib/db"

export async function GET(request: NextRequest) {
  const { isAdmin, response } = await verifyAdminAccess(request)
  if (!isAdmin) return response

  try {
    const result = await db.execute(`
      SELECT
        u.id,
        u.email,
        u.name,
        u.plan,
        u.createdAt,
        COALESCE(u.disabled, 0) as disabled
      FROM users u
      ORDER BY u.createdAt DESC
      LIMIT 500
    `)

    const rows = Array.isArray(result) ? result : result.rows || []
    const users = rows.map((row: any) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      plan: row.plan || "free",
      createdAt: row.createdAt || 0,
      disabled: row.disabled === 1,
      lastActive: null,
    }))

    return NextResponse.json({ users })
  } catch (error) {
    console.error("Error fetching users:", error)
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  const { isAdmin, response } = await verifyAdminAccess(request)
  if (!isAdmin) return response

  try {
    const body = await request.json()
    const { userId, plan, disabled } = body

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      )
    }

    // Update users table if plan is provided
    if (plan) {
      await db.execute(
        "UPDATE users SET plan = ?, updatedAt = ? WHERE id = ?",
        [plan, Math.floor(Date.now() / 1000), userId]
      )
    }

    // Update disabled status if provided
    if (disabled !== undefined) {
      await db.execute(
        "UPDATE users SET disabled = ?, updatedAt = ? WHERE id = ?",
        [disabled ? 1 : 0, Math.floor(Date.now() / 1000), userId]
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating user:", error)
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    )
  }
}
