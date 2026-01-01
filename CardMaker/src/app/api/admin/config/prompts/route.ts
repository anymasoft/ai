import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { ADMIN_EMAIL } from "@/lib/admin-config"
import { db } from "@/lib/db"

// Проверка админского доступа
async function checkAdminAccess(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
    return false
  }
  return true
}

// GET /api/admin/config/prompts - получить промпты из БД
export async function GET(request: NextRequest) {
  const isAdmin = await checkAdminAccess(request)
  if (!isAdmin) {
    return NextResponse.json(
      { error: "Доступ запрещен" },
      { status: 403 }
    )
  }

  try {
    const result = await db.execute(
      `SELECT key, content FROM system_prompts WHERE is_active = 1 ORDER BY key`
    )

    const prompts = Object.fromEntries(
      (result.rows as Array<{ key: string; content: string }>).map((row) => [
        row.key,
        row.content,
      ])
    )

    return NextResponse.json({
      gen_base: prompts.gen_base || "",
      validate_base: prompts.validate_base || "",
    })
  } catch (error) {
    console.error("❌ Error fetching prompts:", error)
    return NextResponse.json(
      { error: "Failed to fetch prompts" },
      { status: 500 }
    )
  }
}

// PUT /api/admin/config/prompts - сохранить промпты в БД
export async function PUT(request: NextRequest) {
  const isAdmin = await checkAdminAccess(request)
  if (!isAdmin) {
    return NextResponse.json(
      { error: "Доступ запрещен" },
      { status: 403 }
    )
  }

  try {
    const body = await request.json()

    // Валидация
    if (typeof body.gen_base !== "string" || typeof body.validate_base !== "string") {
      return NextResponse.json(
        { error: "Invalid prompts format" },
        { status: 400 }
      )
    }

    // Обновить оба промпта в БД
    await db.execute(
      `UPDATE system_prompts SET content = ?, updated_at = cast(strftime('%s','now') as integer)
       WHERE key = ?`,
      [body.gen_base, "gen_base"]
    )

    await db.execute(
      `UPDATE system_prompts SET content = ?, updated_at = cast(strftime('%s','now') as integer)
       WHERE key = ?`,
      [body.validate_base, "validate_base"]
    )

    return NextResponse.json({
      gen_base: body.gen_base,
      validate_base: body.validate_base,
    })
  } catch (error) {
    console.error("❌ Error updating prompts:", error)
    return NextResponse.json(
      { error: "Failed to update prompts" },
      { status: 500 }
    )
  }
}

