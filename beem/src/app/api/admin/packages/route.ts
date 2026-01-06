/**
 * API для управления пакетами
 * GET /api/admin/packages - получить все пакеты
 */

import { verifyAdminAccess } from "@/lib/admin-api"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { isAdmin, response } = await verifyAdminAccess(request)
  if (!isAdmin) return response

  try {
    const result = await db.execute(
      `SELECT key, title, price_rub, generations, is_active, created_at, updated_at FROM packages ORDER BY price_rub ASC`
    )

    const packages = Array.isArray(result) ? result : result.rows || []

    return NextResponse.json({ success: true, packages })
  } catch (error) {
    console.error("[API] Error fetching packages:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка при загрузке пакетов" },
      { status: 500 }
    )
  }
}
