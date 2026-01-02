/**
 * API для управления пакетами
 * GET /api/admin/packages - получить все пакеты
 * PUT /api/admin/packages/{key} - обновить пакет
 */

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return { ok: false, response: NextResponse.json(
      { error: "Требуется аутентификация" },
      { status: 401 }
    )};
  }

  // Проверяем, что пользователь - администратор
  const result = await db.execute(
    "SELECT role FROM users WHERE id = ?",
    [session.user.id]
  );
  const rows = Array.isArray(result) ? result : result.rows || [];

  if (rows.length === 0 || rows[0].role !== "admin") {
    return { ok: false, response: NextResponse.json(
      { error: "Доступ запрещен" },
      { status: 403 }
    )};
  }

  return { ok: true, userId: session.user.id };
}

// GET /api/admin/packages
export async function GET() {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const result = await db.execute(
      `SELECT key, title, price_rub, generations, is_active, created_at, updated_at FROM packages ORDER BY price_rub ASC`
    );

    const packages = Array.isArray(result) ? result : result.rows || [];

    return NextResponse.json({ success: true, packages });
  } catch (error) {
    console.error("[API] Error fetching packages:", error);
    return NextResponse.json(
      { success: false, error: "Ошибка при загрузке пакетов" },
      { status: 500 }
    );
  }
}
