import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { verifyAdminAccess } from "@/lib/admin-api"

export async function GET(request: NextRequest) {
  const { isAdmin, response } = await verifyAdminAccess(request)
  if (!isAdmin) return response

  try {
    const id = request.nextUrl.searchParams.get('id')

    const result = await db.execute(
      `SELECT id, email, firstName, lastName, subject, message, createdAt, isRead
       FROM admin_messages
       WHERE id = ?`,
      [id]
    )

    const message = result.rows?.[0]

    if (!message) {
      return NextResponse.json(
        { error: "Сообщение не найдено" },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { message },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error fetching message:", error)
    return NextResponse.json(
      { error: "Ошибка при загрузке сообщения" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  const { isAdmin, response } = await verifyAdminAccess(request)
  if (!isAdmin) return response

  try {
    const id = request.nextUrl.searchParams.get('id')

    await db.execute(
      `DELETE FROM admin_messages WHERE id = ?`,
      [id]
    )

    return NextResponse.json(
      { success: true },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error deleting message:", error)
    return NextResponse.json(
      { error: "Ошибка при удалении сообщения" },
      { status: 500 }
    )
  }
}
