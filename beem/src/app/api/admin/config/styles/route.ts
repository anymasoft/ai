import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { ADMIN_EMAIL } from "@/lib/admin-config"
import { db } from "@/lib/db"

async function checkAdminAccess(request: NextRequest) {
  const session = await getServerSession(authOptions)
  return session?.user?.email === ADMIN_EMAIL
}

// GET /api/admin/config/styles - получить все стили
export async function GET(request: NextRequest) {
  const isAdmin = await checkAdminAccess(request)
  if (!isAdmin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 })
  }

  try {
    const result = await db.execute(
      `SELECT id, key, title, prompt, is_active FROM styles ORDER BY key`
    )

    return NextResponse.json({
      styles: result.rows || [],
    })
  } catch (error) {
    console.error("❌ Error fetching styles:", error)
    return NextResponse.json({ error: "Failed to fetch styles" }, { status: 500 })
  }
}

// PUT /api/admin/config/styles - обновить стили
export async function PUT(request: NextRequest) {
  const isAdmin = await checkAdminAccess(request)
  if (!isAdmin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 })
  }

  try {
    const body = await request.json()

    if (!Array.isArray(body.styles)) {
      return NextResponse.json({ error: "Invalid styles format" }, { status: 400 })
    }

    // Обновить каждый стиль
    for (const style of body.styles) {
      if (!style.key || typeof style.prompt !== "string") {
        return NextResponse.json({ error: "Invalid style data" }, { status: 400 })
      }

      await db.execute(
        `UPDATE styles SET prompt = ?, updated_at = cast(strftime('%s','now') as integer)
         WHERE key = ?`,
        [style.prompt, style.key]
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("❌ Error updating styles:", error)
    return NextResponse.json({ error: "Failed to update styles" }, { status: 500 })
  }
}
