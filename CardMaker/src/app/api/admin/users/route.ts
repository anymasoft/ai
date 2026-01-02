import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { verifyAdminAccess } from "@/lib/admin-api"
import { db } from "@/lib/db"

// Валидные тарифные планы
const VALID_PLANS = ["free", "basic", "professional", "enterprise", "pro", "business"]

// Схема валидации для PATCH запроса
const updateUserSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  plan: z.enum([...VALID_PLANS] as [string, ...string[]]).optional(),
  disabled: z.boolean().optional(),
  total_generations: z.number().int().min(0).optional(),
  reset_used: z.boolean().optional(),
})

export async function GET(request: NextRequest) {
  const { isAdmin, response } = await verifyAdminAccess(request)
  if (!isAdmin) return response

  try {
    const result = await db.execute(
      `SELECT
        u.id,
        u.email,
        u.name,
        u.plan,
        u.expiresAt,
        u.createdAt,
        COALESCE(u.disabled, 0) as disabled,
        COALESCE(u.total_generations, 0) as total_generations,
        COALESCE(u.used_generations, 0) as used_generations
      FROM users u
      ORDER BY u.createdAt DESC
      LIMIT 500`
    )

    const rows = Array.isArray(result) ? result : result.rows || []
    console.log(`[GET /api/admin/users] Loaded ${rows.length} users`)

    const users = rows.map((row: any) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      plan: row.plan || "free",
      expiresAt: row.expiresAt || null,
      createdAt: row.createdAt || 0,
      disabled: row.disabled === 1,
      total_generations: row.total_generations || 0,
      used_generations: row.used_generations || 0,
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

    // Валидируем данные
    const validation = updateUserSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: `Validation error: ${validation.error.errors[0].message}` },
        { status: 400 }
      )
    }

    const { userId, plan, disabled, total_generations, reset_used } = validation.data
    const updatedAt = Math.floor(Date.now() / 1000)

    // Проверить существование пользователя
    const userCheck = await db.execute(
      "SELECT id FROM users WHERE id = ?",
      [userId]
    )
    const userRows = Array.isArray(userCheck) ? userCheck : userCheck.rows || []
    if (userRows.length === 0) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      )
    }

    // Update users table
    if (plan) {
      await db.execute(
        "UPDATE users SET plan = ?, updatedAt = ? WHERE id = ?",
        [plan, updatedAt, userId]
      )
    }

    if (disabled !== undefined) {
      await db.execute(
        "UPDATE users SET disabled = ?, updatedAt = ? WHERE id = ?",
        [disabled ? 1 : 0, updatedAt, userId]
      )
    }

    if (total_generations !== undefined) {
      await db.execute(
        "UPDATE users SET total_generations = ?, updatedAt = ? WHERE id = ?",
        [total_generations, updatedAt, userId]
      )
    }

    if (reset_used === true) {
      await db.execute(
        "UPDATE users SET used_generations = 0, updatedAt = ? WHERE id = ?",
        [updatedAt, userId]
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
