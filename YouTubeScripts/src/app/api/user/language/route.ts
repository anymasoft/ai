import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createClient } from "@libsql/client";

/**
 * GET /api/user/language
 * Возвращает текущий язык пользователя
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Подключаемся к БД
    const dbPath = process.env.DATABASE_URL || "file:sqlite.db";
    const client = createClient({
      url: dbPath.startsWith("file:") ? dbPath : `file:${dbPath}`,
    });

    // Получаем язык пользователя
    const result = await client.execute({
      sql: `SELECT language FROM users WHERE id = ?`,
      args: [session.user.id],
    });

    client.close();

    if (result.rows.length === 0) {
      return NextResponse.json({ language: "en" });
    }

    const language = (result.rows[0].language as string) || "en";

    return NextResponse.json({ language });
  } catch (error) {
    console.error("[UserLanguageAPI GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to get user language" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/language
 * Обновляет язык пользователя
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const language = body.language as string;

    if (!language || !["en", "ru"].includes(language)) {
      return NextResponse.json(
        { error: "Invalid language. Must be 'en' or 'ru'." },
        { status: 400 }
      );
    }

    console.log(`[UserLanguageAPI POST] Обновление языка пользователя ${session.user.id} на ${language}`);

    // Подключаемся к БД
    const dbPath = process.env.DATABASE_URL || "file:sqlite.db";
    const client = createClient({
      url: dbPath.startsWith("file:") ? dbPath : `file:${dbPath}`,
    });

    // Обновляем язык пользователя
    await client.execute({
      sql: `UPDATE users SET language = ? WHERE id = ?`,
      args: [language, session.user.id],
    });

    client.close();

    console.log(`[UserLanguageAPI POST] Язык пользователя успешно обновлён`);

    return NextResponse.json({ success: true, language });
  } catch (error) {
    console.error("[UserLanguageAPI POST] Error:", error);
    return NextResponse.json(
      { error: "Failed to update user language" },
      { status: 500 }
    );
  }
}
