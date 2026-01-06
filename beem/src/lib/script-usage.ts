/**
 * Утилиты для получения информации о балансе описаний пользователя
 */

import { db } from "@/lib/db";

/**
 * Получить информацию о балансе описаний пользователя
 * Возвращает баланс (осталось) и статистику использования
 */
export async function getBillingScriptUsageInfo(
  userId: string,
): Promise<{
  balance: number;
  used: number;
}> {
  try {
    const result = await db.execute(
      "SELECT generation_balance, generation_used FROM users WHERE id = ?",
      [userId]
    );

    const rows = Array.isArray(result) ? result : result.rows || [];

    if (!rows[0]) {
      throw new Error("User not found");
    }

    const balance = rows[0].generation_balance || 0;
    const used = rows[0].generation_used || 0;

    return {
      balance,
      used,
    };
  } catch (error) {
    console.error("[BillingScriptUsageInfo] Error:", error);
    throw error;
  }
}
