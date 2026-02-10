import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createClient } from "@libsql/client";
import { Language } from "@/lib/i18n";

/**
 * Серверная функция для получения языка пользователя
 * Используется в Server Components (например, в layout.tsx)
 *
 * @returns Язык пользователя или "en" по умолчанию
 */
export async function getUserLanguageServer(): Promise<Language> {
  try {
    // Получаем сессию на стороне сервера
    const session = await getServerSession(authOptions);

    // Если пользователь не авторизован, возвращаем английский
    if (!session?.user?.id) {
      return "en";
    }

    // Подключаемся к БД
    const dbPath = process.env.DATABASE_URL || "file:sqlite.db";
    const client = createClient({
      url: dbPath.startsWith("file:") ? dbPath : `file:${dbPath}`,
    });

    // Получаем язык пользователя из БД
    const result = await client.execute({
      sql: `SELECT language FROM users WHERE id = ?`,
      args: [session.user.id],
    });

    client.close();

    // Если записи нет или язык пустой, возвращаем английский
    if (result.rows.length === 0 || !result.rows[0].language) {
      return "en";
    }

    const language = result.rows[0].language as string;

    // Проверяем, что язык допустимый
    if (language === "en" || language === "ru") {
      return language as Language;
    }

    // Если язык неизвестный, возвращаем английский
    return "en";
  } catch (error) {
    console.error("[getUserLanguageServer] Error:", error);
    // В случае ошибки возвращаем английский по умолчанию
    return "en";
  }
}
