import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { verifyAdminAccess } from "@/lib/admin-api"
import { updateUserPlan } from "@/lib/payments"

// Валидные планы (source of truth)
const VALID_PLANS = ["free", "basic", "professional", "enterprise"]

const changePlanSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  plan: z.enum([...VALID_PLANS] as [string, ...string[]]),
})

export async function POST(request: NextRequest) {
  const { isAdmin, response } = await verifyAdminAccess(request)
  if (!isAdmin) return response

  try {
    const body = await request.json()

    const validation = changePlanSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: `Validation error: ${validation.error.errors[0].message}` },
        { status: 400 }
      )
    }

    const { userId, plan } = validation.data
    const now = Math.floor(Date.now() / 1000)

    // ЖЕСТКОЕ ПРАВИЛО: ВСЕГДА сбрасываем usage при смене плана
    if (plan === "free") {
      // For free plan: reset usage and clear expiration
      await updateUserPlan({
        userId,
        plan: "free",
        expiresAt: null,
        paymentProvider: "manual",
      })
    } else {
      // For paid plans: reset usage and set expiration to 30 days from now
      const expiresAt = now + (30 * 24 * 60 * 60)
      await updateUserPlan({
        userId,
        plan: plan as "basic" | "professional" | "enterprise",
        expiresAt,
        paymentProvider: "manual",
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error changing plan:", error)
    return NextResponse.json(
      { error: "Failed to change plan" },
      { status: 500 }
    )
  }
}
