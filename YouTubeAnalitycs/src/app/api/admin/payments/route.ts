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

// Helper function to parse date string as local date
function parseLocalDate(dateString: string): number {
  const [year, month, day] = dateString.split('-').map(Number)
  // Create date in local timezone (00:00:00)
  const date = new Date(year, month - 1, day, 0, 0, 0, 0)
  // Convert to Unix timestamp (seconds)
  return Math.floor(date.getTime() / 1000)
}

export async function GET(request: NextRequest) {
  const { isAdmin, response } = await verifyAdminAccess(request)
  if (!isAdmin) return response

  try {
    const { searchParams } = new URL(request.url)
    const emailFilter = searchParams.get("email") || ""
    const fromDateStr = searchParams.get("from")
    const toDateStr = searchParams.get("to")

    let fromDate: number | null = null
    let toDate: number | null = null

    if (fromDateStr) {
      fromDate = parseLocalDate(fromDateStr)
    }

    if (toDateStr) {
      toDate = parseLocalDate(toDateStr)
      // Add 24 hours (86400 seconds) to toDate to include the entire day
      toDate += 86400
    }

    // Get only real YooKassa payments from payments table
    let query = `
      SELECT
        p.id,
        p.userId,
        u.email,
        p.plan,
        p.amount,
        p.expiresAt,
        p.provider,
        p.createdAt
      FROM payments p
      JOIN users u ON p.userId = u.id
      WHERE p.provider = 'yookassa'
    `

    const params: any[] = []

    if (emailFilter) {
      query += ` AND u.email LIKE ?`
      params.push(`%${emailFilter}%`)
    }

    if (fromDate) {
      query += ` AND p.createdAt >= ?`
      params.push(fromDate)
    }

    if (toDate) {
      query += ` AND p.createdAt < ?`
      params.push(toDate)
    }

    query += ` ORDER BY p.createdAt DESC LIMIT 500`

    const result = params.length > 0
      ? await db.execute({ sql: query, args: params })
      : await db.execute(query)

    const rows = Array.isArray(result) ? result : result.rows || []

    const payments = rows.map((row: any) => ({
      id: row.id,
      userId: row.userId,
      email: row.email,
      plan: row.plan,
      expiresAt: row.expiresAt,
      provider: row.provider,
      price: row.amount,
      createdAt: row.createdAt,
    }))

    // Calculate total sum
    const totalSum = payments.reduce((sum, payment) => {
      const priceStr = payment.price.replace(/[^\d]/g, "")
      const priceNum = parseInt(priceStr) || 0
      return sum + priceNum
    }, 0)

    return NextResponse.json({
      payments,
      total: payments.length,
      totalSum,
    })
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
