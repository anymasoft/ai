import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { verifyAdminAccess } from "@/lib/admin-api"

export async function GET(request: NextRequest) {
  const { isAdmin, response } = await verifyAdminAccess(request)
  if (!isAdmin) return response

  try {
    const result = await db.execute(
      `SELECT id, email, firstName, lastName, subject, message, createdAt, isRead
       FROM admin_messages
       ORDER BY createdAt DESC
       LIMIT 100`
    )

    return NextResponse.json(
      { messages: result.rows || [] },
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
