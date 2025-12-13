/**
 * Утилиты для получения информации об использовании сценариев пользователем
 */

import { db } from "@/lib/db";
import { getMonthlyScriptLimit } from "@/config/plan-limits";
import type { PlanType } from "@/config/plan-limits";

/**
 * Получить количество используемых сценариев в текущем месяце
 * Считает сценарии за весь текущий месяц (с 1-го по сегодня)
 */
export async function getMonthlyScriptsUsed(userId: string): Promise<number> {
  try {
    // Получаем текущую дату в формате YYYY-MM-01
    const today = new Date();
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthPrefix = firstDayOfMonth.toISOString().split('T')[0]; // YYYY-MM-01

    // Получаем использование всех дней в текущем месяце
    const result = await db.execute({
      sql: `
        SELECT COALESCE(SUM(scriptsUsed), 0) as totalUsed
        FROM user_usage_daily
        WHERE userId = ? AND day LIKE ?
      `,
      args: [userId, monthPrefix.substring(0, 7) + '%'], // YYYY-MM%
    });

    const rows = Array.isArray(result) ? result : result.rows || [];
    const totalUsed = rows[0]?.totalUsed || 0;

    console.log("[ScriptUsage] SUM query: userId =", userId, "result rows =", JSON.stringify(rows), "totalUsed =", totalUsed);

    return Number(totalUsed);
  } catch (error) {
    console.error("[ScriptUsage] Ошибка при получении monthly usage:", error);
    // Возвращаем 0 при ошибке, UI покажет "Статистика появится после первой генерации"
    return 0;
  }
}

/**
 * Получить информацию об использовании сценариев для страницы биллинга
 * Возвращает объект с используемыми и оставшимися сценариями
 */
export async function getBillingScriptUsageInfo(
  userId: string,
  plan: PlanType
): Promise<{
  monthlyLimit: number;
  monthlyUsed: number;
  monthlyRemaining: number;
  percentageUsed: number;
}> {
  const monthlyLimit = getMonthlyScriptLimit(plan);
  const monthlyUsed = await getMonthlyScriptsUsed(userId);
  const monthlyRemaining = Math.max(0, monthlyLimit - monthlyUsed);
  const percentageUsed = monthlyLimit > 0 ? Math.round((monthlyUsed / monthlyLimit) * 100) : 0;

  // Логирование для диагностики: показать все записи пользователя в user_usage_daily
  try {
    const allRecords = await db.execute({
      sql: `SELECT userId, day, scriptsUsed FROM user_usage_daily WHERE userId = ? ORDER BY day DESC LIMIT 10`,
      args: [userId],
    });
    const records = Array.isArray(allRecords) ? allRecords : allRecords.rows || [];
    console.log("[BillingScriptUsageInfo] user_usage_daily records for userId =", userId, ":", JSON.stringify(records));
  } catch (err) {
    console.error("[BillingScriptUsageInfo] Error selecting records:", err);
  }

  return {
    monthlyLimit,
    monthlyUsed,
    monthlyRemaining,
    percentageUsed,
  };
}
