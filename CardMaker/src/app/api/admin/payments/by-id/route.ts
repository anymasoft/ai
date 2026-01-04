import { NextRequest, NextResponse } from "next/server"
import { verifyAdminAccess } from "@/lib/admin-api"
import { db } from "@/lib/db"

export async function DELETE(request: NextRequest) {
  const { isAdmin, response } = await verifyAdminAccess(request)
  if (!isAdmin) return response

  try {
    const id = request.nextUrl.searchParams.get('id')

    // id — это строка вида "payment_timestamp_userId"
    if (!id || typeof id !== 'string' || id.trim() === '') {
      return NextResponse.json(
        { error: "Payment ID required" },
        { status: 400 }
      )
    }

    // Удаляем платеж из таблицы по текстовому id
    const result = await db.execute(
      `DELETE FROM payments WHERE id = ?`,
      [id]
    )

    return NextResponse.json({
      success: true,
      message: "Payment deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting payment:", error)
    return NextResponse.json(
      { error: "Failed to delete payment" },
      { status: 500 }
    )
  }
}
