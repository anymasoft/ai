import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { ADMIN_EMAIL } from "@/lib/admin-config"

// TODO: Заменить на реальное хранилище конфигов (БД)
let prompts = {
  gen_base: "",
  validate_base: "",
}

// Проверка админского доступа
async function checkAdminAccess(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
    return false
  }
  return true
}

// GET /api/admin/config/prompts - получить промпты
export async function GET(request: NextRequest) {
  const isAdmin = await checkAdminAccess(request)
  if (!isAdmin) {
    return NextResponse.json(
      { error: "Доступ запрещен" },
      { status: 403 }
    )
  }

  return NextResponse.json(prompts)
}

// PUT /api/admin/config/prompts - сохранить промпты
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

    prompts = {
      gen_base: body.gen_base,
      validate_base: body.validate_base,
    }

    return NextResponse.json(prompts)
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to parse request" },
      { status: 400 }
    )
  }
}
