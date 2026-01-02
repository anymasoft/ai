import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { verifyAdminAccess } from "@/lib/admin-api"
import { db } from "@/lib/db"

// Схема валидации для PATCH запроса
const updateUserSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  generation_balance: z.number().int().min(0),
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
        u.createdAt,
        COALESCE(u.disabled, 0) as disabled,
        COALESCE(u.generation_balance, 0) as generation_balance,
        COALESCE(u.generation_used, 0) as generation_used
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
      createdAt: row.createdAt || 0,
      disabled: row.disabled === 1,
      generation_balance: row.generation_balance || 0,
      generation_used: row.generation_used || 0,
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

    const { userId, generation_balance } = validation.data
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

    // Обновляем generation_balance пользователя
    await db.execute(
      "UPDATE users SET generation_balance = ?, updatedAt = ? WHERE id = ?",
      [generation_balance, updatedAt, userId]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating user:", error)
    return NextResponse.json(
      { error: "Failed to update user" },
      { status: 500 }
    )
  }
}
