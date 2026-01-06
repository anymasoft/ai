import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"

/**
 * Проверяет если текущий пользователь заблокирован (disabled)
 * Используется при sign-in для проверки статуса пользователя
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ disabled: false })
    }

    const result = await db.execute(
      "SELECT disabled FROM users WHERE id = ?",
      [session.user.id]
    )

    const rows = Array.isArray(result) ? result : result.rows || []
    if (rows.length === 0) {
      return NextResponse.json({ disabled: false })
    }

    const user = rows[0]
    const isDisabled = user.disabled === 1 || user.disabled === true

    if (isDisabled) {
      // Logout и перенаправить на access-denied
      return NextResponse.json(
        {
          disabled: true,
          redirectTo: "/errors/access-denied"
        },
        { status: 200 }
      )
    }

    return NextResponse.json({ disabled: false })
  } catch (error) {
    console.error("Error checking disabled status:", error)
    return NextResponse.json(
      { error: "Failed to check status" },
      { status: 500 }
    )
  }
}
