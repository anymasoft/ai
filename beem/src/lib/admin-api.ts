/**
 * Admin API Helpers
 * Утилиты для проверки доступа и работы с админ-эндпоинтами
 */

import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { ADMIN_EMAIL } from "@/lib/admin-config"
import { NextRequest, NextResponse } from "next/server"

/**
 * Проверить, что пользователь админ, для API эндпоинтов
 */
export async function verifyAdminAccess(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email || session.user.email !== ADMIN_EMAIL) {
    return {
      isAdmin: false,
      response: NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 }
      ),
    }
  }

  return {
    isAdmin: true,
    response: null,
  }
}
