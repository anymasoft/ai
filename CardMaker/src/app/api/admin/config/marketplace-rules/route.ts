import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { ADMIN_EMAIL } from "@/lib/admin-config"
import { db } from "@/lib/db"

async function checkAdminAccess(request: NextRequest) {
  const session = await getServerSession(authOptions)
  return session?.user?.email === ADMIN_EMAIL
}

// GET /api/admin/config/marketplace-rules - получить все правила
export async function GET(request: NextRequest) {
  const isAdmin = await checkAdminAccess(request)
  if (!isAdmin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 })
  }

  try {
    const result = await db.execute(
      `SELECT id, marketplace, content, is_active FROM marketplace_rules ORDER BY marketplace`
    )

    return NextResponse.json({
      rules: result.rows || [],
    })
  } catch (error) {
    console.error("❌ Error fetching marketplace rules:", error)
    return NextResponse.json({ error: "Failed to fetch rules" }, { status: 500 })
  }
}

// PUT /api/admin/config/marketplace-rules - обновить правила
export async function PUT(request: NextRequest) {
  const isAdmin = await checkAdminAccess(request)
  if (!isAdmin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 })
  }

  try {
    const body = await request.json()

    if (!Array.isArray(body.rules)) {
      return NextResponse.json({ error: "Invalid rules format" }, { status: 400 })
    }

    // Обновить каждое правило
    for (const rule of body.rules) {
      if (!rule.marketplace || typeof rule.content !== "string") {
        return NextResponse.json({ error: "Invalid rule data" }, { status: 400 })
      }

      await db.execute(
        `UPDATE marketplace_rules SET content = ?, updated_at = cast(strftime('%s','now') as integer)
         WHERE marketplace = ?`,
        [rule.content, rule.marketplace]
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("❌ Error updating marketplace rules:", error)
    return NextResponse.json({ error: "Failed to update rules" }, { status: 500 })
  }
}
