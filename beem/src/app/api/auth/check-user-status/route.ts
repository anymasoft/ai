import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

/**
 * Проверить статус пользователя (disabled или нет)
 * Используется при OAuth callback для проверки что пользователь не заблокирован
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      )
    }

    const result = await db.execute(
      "SELECT disabled FROM users WHERE id = ?",
      [userId]
    )

    const rows = Array.isArray(result) ? result : result.rows || []
    if (rows.length === 0) {
      // Новый пользователь, OK
      return NextResponse.json({ allowed: true })
    }

    const user = rows[0]
    if (user.disabled === 1 || user.disabled === true) {
      // Пользователь заблокирован
      return NextResponse.json({
        allowed: false,
        redirectTo: "/errors/access-denied"
      })
    }

    return NextResponse.json({ allowed: true })
  } catch (error) {
    console.error("Error checking user status:", error)
    return NextResponse.json(
      { error: "Failed to check user status" },
      { status: 500 }
    )
  }
}
