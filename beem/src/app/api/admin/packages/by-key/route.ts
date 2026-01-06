/**
 * API для управления конкретным пакетом
 * PUT /api/admin/packages/by-key - обновить пакет
 */

import { verifyAdminAccess } from "@/lib/admin-api"
import { db } from "@/lib/db"
import { NextRequest, NextResponse } from "next/server"

export async function PUT(request: NextRequest) {
  const { isAdmin, response } = await verifyAdminAccess(request)
  if (!isAdmin) return response

  try {
    const key = request.nextUrl.searchParams.get("key")
    const body = await request.json()
    const { price_rub, generations, is_active } = body

    // Валидация
    if (typeof price_rub !== "number" || price_rub < 0) {
      return NextResponse.json(
        { success: false, error: "Некорректная цена" },
        { status: 400 }
      )
    }

    if (typeof generations !== "number" || generations < 0) {
      return NextResponse.json(
        { success: false, error: "Некорректное количество генераций" },
        { status: 400 }
      )
    }

    const now = Math.floor(Date.now() / 1000)

    // Обновляем пакет
    await db.execute(
      `UPDATE packages SET price_rub = ?, generations = ?, is_active = ?, updated_at = ? WHERE key = ?`,
      [price_rub, generations, is_active ? 1 : 0, now, key]
    )

    console.log(
      `[Admin] Package updated: ${key}, price=${price_rub}, generations=${generations}`
    )

    return NextResponse.json({
      success: true,
      message: `Пакет "${key}" обновлен`,
    })
  } catch (error) {
    console.error("[API] Error updating package:", error)
    return NextResponse.json(
      { success: false, error: "Ошибка при обновлении пакета" },
      { status: 500 }
    )
  }
}
