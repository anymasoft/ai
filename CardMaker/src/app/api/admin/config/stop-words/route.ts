import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { ADMIN_EMAIL } from "@/lib/admin-config"
import { db } from "@/lib/db"

async function checkAdminAccess(request: NextRequest) {
  const session = await getServerSession(authOptions)
  return session?.user?.email === ADMIN_EMAIL
}

// GET /api/admin/config/stop-words - получить все стоп-слова
export async function GET(request: NextRequest) {
  const isAdmin = await checkAdminAccess(request)
  if (!isAdmin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 })
  }

  try {
    const result = await db.execute(
      `SELECT id, marketplace, category, words, is_active FROM stop_words ORDER BY marketplace, category`
    )

    return NextResponse.json({
      stopWords: result.rows || [],
    })
  } catch (error) {
    console.error("❌ Error fetching stop words:", error)
    return NextResponse.json({ error: "Failed to fetch stop words" }, { status: 500 })
  }
}

// PUT /api/admin/config/stop-words - добавить/обновить стоп-слова
export async function PUT(request: NextRequest) {
  const isAdmin = await checkAdminAccess(request)
  if (!isAdmin) {
    return NextResponse.json({ error: "Доступ запрещен" }, { status: 403 })
  }

  try {
    const body = await request.json()

    if (!Array.isArray(body.stopWords)) {
      return NextResponse.json({ error: "Invalid stop words format" }, { status: 400 })
    }

    // Обновить или создать записи
    for (const sw of body.stopWords) {
      if (typeof sw.category !== "string" || typeof sw.words !== "string") {
        return NextResponse.json({ error: "Invalid stop word data" }, { status: 400 })
      }

      const marketplace = sw.marketplace || null

      // Проверить, существует ли запись
      const existing = await db.execute(
        `SELECT id FROM stop_words WHERE marketplace = ? AND category = ?`,
        [marketplace, sw.category]
      )

      if ((existing.rows?.length || 0) > 0) {
        // Обновить
        await db.execute(
          `UPDATE stop_words SET words = ?, updated_at = cast(strftime('%s','now') as integer)
           WHERE marketplace = ? AND category = ?`,
          [sw.words, marketplace, sw.category]
        )
      } else {
        // Вставить (только если данные приходят явно)
        if (sw.id) {
          await db.execute(
            `INSERT INTO stop_words (id, marketplace, category, words, is_active)
             VALUES (?, ?, ?, ?, 1)`,
            [sw.id, marketplace, sw.category, sw.words]
          )
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("❌ Error updating stop words:", error)
    return NextResponse.json({ error: "Failed to update stop words" }, { status: 500 })
  }
}
