/**
 * GET /api/user
 *
 * Возвращает информацию о текущем пользователе
 * Всегда читает напрямую из БД таблицы users
 * БЕЗ кэширования, БЕЗ fallback, БЕЗ вычислений
 *
 * Response:
 * {
 *   id: string
 *   email: string
 *   name: string
 *   generation_balance: number
 *   generation_used: number
 *   disabled: boolean
 * }
 */

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Проверяем аутентификацию
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Требуется аутентификация" },
        { status: 401 }
      );
    }

    // Импортируем БД
    const { db } = await import("@/lib/db");

    // КРИТИЧЕСКОЕ: Читаем НАПРЯМУЮ ИЗ БД, БЕЗ кэширования
    const result = await db.execute(
      `SELECT id, email, name, generation_balance, generation_used, disabled
       FROM users WHERE id = ?`,
      [session.user.id]
    );

    const rows = Array.isArray(result) ? result : result.rows || [];

    if (rows.length === 0) {
      // Пользователь не найден в БД (что-то пошло не так)
      console.error(`[GET /api/user] User ${session.user.id} not found in DB`);
      return NextResponse.json(
        { error: "Пользователь не найден" },
        { status: 404 }
      );
    }

    const user = rows[0];

    // Нормализуем данные
    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      generation_balance: user.generation_balance || 0,
      generation_used: user.generation_used || 0,
      disabled: user.disabled === 1 || user.disabled === true,
    });
  } catch (error) {
    console.error("[GET /api/user] Error:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
