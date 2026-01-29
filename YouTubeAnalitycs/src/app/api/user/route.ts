/**
 * GET /api/user
 *
 * ЕДИНСТВЕННЫЙ ИСТОЧНИК ИСТИНЫ О ПОЛЬЗОВАТЕЛЕ И ЕГО ТАРИФЕ
 * Всегда читает plan и expiresAt напрямую из БД таблицы users
 * БЕЗ кэширования, БЕЗ fallback, БЕЗ вычислений
 *
 * Response:
 * {
 *   id: string
 *   email: string
 *   name: string
 *   plan: 'free' | 'basic' | 'professional' | 'enterprise'
 *   expiresAt: number | null
 *   paymentProvider: string | null
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

    // Импортируем БД и функции для проверки подписки
    const { db } = await import("@/lib/db");
    const { shouldDowngradeUser, downgradeUserToFree } = await import(
      "@/lib/subscription-downgrade"
    );

    // КРИТИЧЕСКОЕ: Читаем НАПРЯМУЮ ИЗ БД, БЕЗ кэширования
    let result = await db.execute(
      `SELECT id, email, name, plan, expiresAt, paymentProvider, disabled
       FROM users WHERE id = ?`,
      [session.user.id]
    );

    let rows = Array.isArray(result) ? result : result.rows || [];

    if (rows.length === 0) {
      // Пользователь не найден в БД (что-то пошло не так)
      console.error(`[GET /api/user] User ${session.user.id} not found in DB`);
      return NextResponse.json(
        { error: "Пользователь не найден" },
        { status: 404 }
      );
    }

    let user = rows[0];

    // ПРОВЕРКА ИСТЕЧЕНИЯ: Если тариф истёк, автоматически downgrade
    const downgradeCheck = await shouldDowngradeUser(session.user.id);
    if (downgradeCheck.shouldDowngrade) {
      console.log(
        `[GET /api/user] User ${session.user.id} subscription expired, performing downgrade`
      );
      await downgradeUserToFree({
        userId: session.user.id,
        reason: "expired",
        details: "Subscription expiration detected at API read time",
      });

      // Перечитываем данные пользователя после downgrade
      result = await db.execute(
        `SELECT id, email, name, plan, expiresAt, paymentProvider, disabled
         FROM users WHERE id = ?`,
        [session.user.id]
      );
      rows = Array.isArray(result) ? result : result.rows || [];
      user = rows[0];
    }

    // Нормализуем данные
    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan || "free",
      expiresAt: user.expiresAt || null,
      paymentProvider: user.paymentProvider || null,
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
