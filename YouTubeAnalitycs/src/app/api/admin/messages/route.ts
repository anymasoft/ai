import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { verifyAdminAccess } from "@/lib/admin-api"

export async function GET(request: NextRequest) {
  const { isAdmin, response } = await verifyAdminAccess(request)
  if (!isAdmin) return response

  try {
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get("page") || "1")
    const limit = 10
    const offset = (page - 1) * limit
    const emailFilter = searchParams.get("email") || ""

    // Построение WHERE условия
    let whereClause = ""
    const params: any[] = []

    if (emailFilter) {
      whereClause = "WHERE email LIKE ?"
      params.push(`%${emailFilter}%`)
    }

    // Получаем общее количество записей
    const countResult = await db.execute(
      `SELECT COUNT(*) as total FROM admin_messages ${whereClause}`,
      params
    )
    const total = countResult.rows?.[0]?.total || 0

    // Получаем сообщения с пагинацией
    const result = await db.execute(
      `SELECT id, email, firstName, lastName, subject, message, createdAt, isRead
       FROM admin_messages
       ${whereClause}
       ORDER BY createdAt DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json(
      {
        messages: result.rows || [],
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasMore: page < totalPages,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error fetching messages:", error)
    return NextResponse.json(
      { error: "Ошибка при загрузке сообщений" },
      { status: 500 }
    )
  }
}
