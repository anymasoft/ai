/**
 * API для управления балансом пользователя
 * PATCH /api/admin/user-balance - изменить баланс пользователя
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

// PATCH /api/admin/user-balance
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const body = await request.json();
    const { userId, balanceDelta, resetBalance } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Требуется userId" },
        { status: 400 }
      );
    }

    // Проверяем, что пользователь существует
    const userResult = await db.execute(
      "SELECT generation_balance FROM users WHERE id = ?",
      [userId]
    );
    const userRows = Array.isArray(userResult) ? userResult : userResult.rows || [];

    if (userRows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Пользователь не найден" },
        { status: 404 }
      );
    }

    const now = Math.floor(Date.now() / 1000);

    if (resetBalance === true) {
      // Сброс баланса на 0
      await db.execute(
        "UPDATE users SET generation_balance = 0, updatedAt = ? WHERE id = ?",
        [now, userId]
      );
      console.log(`[Admin] User balance reset for ${userId}`);
    } else if (typeof balanceDelta === "number") {
      // Изменение баланса на определенное значение
      await db.execute(
        "UPDATE users SET generation_balance = generation_balance + ?, updatedAt = ? WHERE id = ?",
        [balanceDelta, now, userId]
      );
      console.log(`[Admin] User balance changed by ${balanceDelta} for ${userId}`);
    } else {
      return NextResponse.json(
        { success: false, error: "Требуется balanceDelta или resetBalance" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Баланс обновлен"
    });
  } catch (error) {
    console.error("[API] Error updating user balance:", error);
    return NextResponse.json(
      { success: false, error: "Ошибка при обновлении баланса" },
      { status: 500 }
    );
  }
}
