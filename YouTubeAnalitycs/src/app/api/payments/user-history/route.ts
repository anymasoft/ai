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

    // Получаем все платежи текущего пользователя
    const result = await db.execute(
      `SELECT
        p.id,
        p.plan,
        p.amount,
        p.provider,
        p.status,
        p.expiresAt,
        p.createdAt
      FROM payments p
      JOIN users u ON p.userId = u.id
      WHERE u.email = ?
      ORDER BY p.createdAt DESC
      LIMIT ? OFFSET ?`,
      [session.user.email, limit, offset]
    )

    const rows = Array.isArray(result) ? result : result.rows || []

    const payments = rows.map((row: any) => ({
      id: row.id,
      plan: row.plan,
      amount: row.amount,
      provider: row.provider,
      status: row.status,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
    }))

    // Получаем общее количество платежей
    const countResult = await db.execute(
      `SELECT COUNT(*) as total FROM payments p
       JOIN users u ON p.userId = u.id
       WHERE u.email = ?`,
      [session.user.email]
    )

    const countRows = Array.isArray(countResult) ? countResult : countResult.rows || []
    const total = countRows[0]?.total || 0

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
