import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { ADMIN_EMAIL } from "@/lib/admin-config"
import { db } from "@/lib/db"

async function checkAdminAccess(request: NextRequest) {
  const session = await getServerSession(authOptions)
  return session?.user?.email === ADMIN_EMAIL
}

// GET /api/admin/config/categories - получить все категории
export async function GET(request: NextRequest) {
  const isAdmin = await checkAdminAccess(request)
  if (!isAdmin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 })
  }

  try {
    const result = await db.execute(
      `SELECT id, key, title, prompt, is_active, updated_at FROM category_prompts ORDER BY key`
    )

    const rows = Array.isArray(result) ? result : result.rows || []

    return NextResponse.json({
      categories: rows,
    })
  } catch (error) {
    console.error("❌ Error fetching categories:", error)
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 })
  }
}

// PUT /api/admin/config/categories - обновить категории
export async function PUT(request: NextRequest) {
  const isAdmin = await checkAdminAccess(request)
  if (!isAdmin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 })
  }

  try {
    const body = await request.json()

    if (!Array.isArray(body.items)) {
      return NextResponse.json({ error: "Invalid items format" }, { status: 400 })
    }

    // Обновить каждую категорию
    for (const item of body.items) {
      if (!item.key || typeof item.prompt !== "string") {
        return NextResponse.json({ error: "Invalid category data" }, { status: 400 })
      }

      // Проверяем, существует ли категория
      const checkResult = await db.execute(
        `SELECT id FROM category_prompts WHERE key = ?`,
        [item.key]
      )

      const checkRows = Array.isArray(checkResult) ? checkResult : checkResult.rows || []
      if (checkRows.length === 0) {
        return NextResponse.json(
          { error: `Категория не найдена: ${item.key}` },
          { status: 400 }
        )
      }

      // Обновляем prompt и опциональные поля
      const updates: string[] = ["prompt = ?", "updated_at = cast(strftime('%s','now') as integer)"]
      const values: any[] = [item.prompt]

      if (typeof item.is_active === "number") {
        updates.push("is_active = ?")
        values.push(item.is_active)
      }

      values.push(item.key)

      await db.execute(
        `UPDATE category_prompts SET ${updates.join(", ")} WHERE key = ?`,
        values
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("❌ Error updating categories:", error)
    return NextResponse.json({ error: "Failed to update categories" }, { status: 500 })
  }
}
