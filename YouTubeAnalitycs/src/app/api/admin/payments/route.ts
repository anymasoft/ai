import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { verifyAdminAccess } from "@/lib/admin-api"
import { db } from "@/lib/db"
import { updateUserPlan } from "@/lib/payments"

// Валидные тарифные планы (ТОЛЬКО из PLAN_LIMITS)
const VALID_PLANS = ["basic", "professional", "enterprise"]

// Схема валидации для PATCH запроса
const updatePaymentSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  plan: z.enum([...VALID_PLANS] as [string, ...string[]]),
  expiresAt: z.number().int().positive(),
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
        u.expiresAt,
        COALESCE(u.disabled, 0) as disabled
      FROM users u
      ORDER BY u.createdAt DESC
      LIMIT 500
    `)

    const rows = Array.isArray(result) ? result : result.rows || []
    const now = Math.floor(Date.now() / 1000)

    const payments = rows.map((row: any) => ({
      userId: row.userId,
      email: row.email,
      plan: row.plan || "free",
      disabled: row.disabled === 1,
      isPaid: row.plan !== "free" && row.expiresAt && row.expiresAt > now,
      expiresAt: row.expiresAt,
      provider: "yookassa",
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

    const { userId, plan, expiresAt } = validation.data

    // Используем ту же функцию, что и для платежей через YooKassa
    // Это сбрасывает месячное использование и обновляет план
    await updateUserPlan({
      userId,
      plan: plan as "basic" | "professional" | "enterprise",
      expiresAt,
      paymentProvider: "manual",
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating payment:", error)
    return NextResponse.json(
      { error: "Failed to update payment" },
      { status: 500 }
    )
  }
}
