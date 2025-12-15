import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { verifyAdminAccess } from "@/lib/admin-api"

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { isAdmin, response } = await verifyAdminAccess(request)
  if (!isAdmin) return response

  try {
    const id = params.id

    await db.execute(
      `UPDATE admin_messages SET isRead = 1 WHERE id = ?`,
      [id]
    )

    return NextResponse.json(
      { success: true },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error updating message:", error)
    return NextResponse.json(
      { error: "Ошибка при обновлении сообщения" },
      { status: 500 }
    )
  }
}
