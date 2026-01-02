/**
 * API для управления конкретным пакетом
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

// PUT /api/admin/packages/{key}
export async function PUT(
  request: NextRequest,
  { params }: { params: { key: string } }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const { key } = params;
    const body = await request.json();
    const { price_rub, generations, is_active } = body;

    // Валидация
    if (typeof price_rub !== "number" || price_rub < 0) {
      return NextResponse.json(
        { success: false, error: "Некорректная цена" },
        { status: 400 }
      );
    }

    if (typeof generations !== "number" || generations < 0) {
      return NextResponse.json(
        { success: false, error: "Некорректное количество генераций" },
        { status: 400 }
      );
    }

    const now = Math.floor(Date.now() / 1000);

    // Обновляем пакет
    await db.execute(
      `UPDATE packages SET price_rub = ?, generations = ?, is_active = ?, updated_at = ? WHERE key = ?`,
      [price_rub, generations, is_active ? 1 : 0, now, key]
    );

    console.log(`[Admin] Package updated: ${key}, price=${price_rub}, generations=${generations}`);

    return NextResponse.json({
      success: true,
      message: `Пакет "${key}" обновлен`
    });
  } catch (error) {
    console.error("[API] Error updating package:", error);
    return NextResponse.json(
      { success: false, error: "Ошибка при обновлении пакета" },
      { status: 500 }
    );
  }
}
