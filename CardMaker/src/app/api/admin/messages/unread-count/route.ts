import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { verifyAdminAccess } from "@/lib/admin-api"

export async function GET(request: NextRequest) {
  const { isAdmin, response } = await verifyAdminAccess(request)
  if (!isAdmin) return response

  try {
    const result = await db.execute(
      `SELECT COUNT(*) as unreadCount FROM admin_messages WHERE isRead = 0`
    )

    const unreadCount = result.rows?.[0]?.unreadCount || 0

    return NextResponse.json(
      { unreadCount },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error fetching unread count:", error)
    return NextResponse.json(
      { error: "Ошибка при загрузке количества сообщений" },
      { status: 500 }
    )
  }
}
