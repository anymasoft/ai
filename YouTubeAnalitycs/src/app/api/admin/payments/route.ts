import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { verifyAdminAccess } from "@/lib/admin-api"
import { db } from "@/lib/db"

// Валидные тарифные планы
const VALID_PLANS = ["free", "basic", "professional", "enterprise", "pro", "business"]

// Схема валидации для PATCH запроса
const updatePaymentSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  plan: z.enum([...VALID_PLANS] as [string, ...string[]]).optional(),
  isPaid: z.boolean().optional(),
  expiresAt: z.number().int().positive().optional().nullable(),
  provider: z.string().optional(),
})

export async function GET(request: NextRequest) {
  const { isAdmin, response } = await verifyAdminAccess(request)
  if (!isAdmin) return response

  try {
    const result = await db.execute(`
      SELECT
        u.id as userId,
        u.email,
        u.plan,
        COALESCE(u.disabled, 0) as disabled,
        COALESCE(s.isPaid, 0) as isPaid,
        s.expiresAt,
        COALESCE(s.provider, 'manual') as provider
      FROM users u
      LEFT JOIN admin_subscriptions s ON u.id = s.userId
      ORDER BY u.createdAt DESC
      LIMIT 500
    `)

    const rows = Array.isArray(result) ? result : result.rows || []
    const payments = rows.map((row: any) => ({
      userId: row.userId,
      email: row.email,
      plan: row.plan || "free",
      disabled: row.disabled === 1,
      isPaid: row.isPaid === 1,
      expiresAt: row.expiresAt,
      provider: row.provider,
    }))

    return NextResponse.json({ payments })
  } catch (error) {
    console.error("Error fetching payments:", error)
    return NextResponse.json(
      { error: "Failed to fetch payments" },
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
    const validation = updatePaymentSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: `Validation error: ${validation.error.errors[0].message}` },
        { status: 400 }
      )
    }

    const { userId, plan, isPaid, expiresAt, provider } = validation.data
    const updatedAt = Math.floor(Date.now() / 1000)

    // Insert or update admin_subscriptions
    await db.execute(`
      INSERT OR REPLACE INTO admin_subscriptions
      (userId, plan, isPaid, expiresAt, provider, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      userId,
      plan || "free",
      isPaid ? 1 : 0,
      expiresAt || null,
      provider || "manual",
      updatedAt
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating payment:", error)
    return NextResponse.json(
      { error: "Failed to update payment" },
      { status: 500 }
    )
  }
}
