import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { db } from "@/lib/db"
import { authOptions } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get("limit") || "20", 10)
    const offset = parseInt(searchParams.get("offset") || "0", 10)

    // ⚠️ ВАЖНО: Эта функция не работает для MVP
    // TODO: Исправить SQL запрос — используется несуществующий столбец p.plan
    // Реальный столбец в БД: p.planId (TEXT)
    // После исправления раскомментировать код ниже и удалить заглушку

    // Получаем все платежи текущего пользователя
    // const result = await db.execute(
    //   `SELECT
    //     p.id,
    //     p.planId,
    //     p.amount,
    //     p.provider,
    //     p.status,
    //     p.expiresAt,
    //     p.createdAt
    //   FROM payments p
    //   JOIN users u ON p.userId = u.id
    //   WHERE u.email = ?
    //   ORDER BY p.createdAt DESC
    //   LIMIT ? OFFSET ?`,
    //   [session.user.email, limit, offset]
    // )

    // Временная заглушка для MVP (история платежей отключена)
    const result = []

    // Заглушка для MVP: возвращаем пустой результат
    const payments: any[] = []
    const total = 0

    return NextResponse.json({
      payments,
      total,
      limit,
      offset,
    })
  } catch (error) {
    console.error("Error fetching payment history:", error)
    return NextResponse.json(
      { error: "Failed to fetch payment history" },
      { status: 500 }
    )
  }
}
