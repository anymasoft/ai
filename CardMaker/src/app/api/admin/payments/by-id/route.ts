import { NextRequest, NextResponse } from "next/server"
import { verifyAdminAccess } from "@/lib/admin-api"
import { db } from "@/lib/db"

export async function DELETE(request: NextRequest) {
  const { isAdmin, response } = await verifyAdminAccess(request)
  if (!isAdmin) return response

  try {
    const id = request.nextUrl.searchParams.get('id')
    const paymentId = parseInt(id || '', 10)
    if (isNaN(paymentId)) {
      return NextResponse.json(
        { error: "Invalid payment ID" },
        { status: 400 }
      )
    }

    // Удаляем платеж из таблицы
    const result = await db.execute(
      `DELETE FROM payments WHERE id = ?`,
      [paymentId]
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
