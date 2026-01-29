/**
 * Утилиты для работы с тарифными планами пользователей
 */

import type { Session } from "next-auth";
import type { UserPlan } from "@/config/limits";

/**
 * Получает план пользователя из сессии
 * По умолчанию возвращает "trial" если план не определён
 */
export function getUserPlan(session: Session | null): UserPlan {
  if (!session?.user?.plan) {
    return "trial";
  }

  const plan = session.user.plan;

  // Проверяем что план валидный
  if (plan === "trial" || plan === "basic" || plan === "professional" || plan === "enterprise") {
    return plan;
  }

  // Fallback на trial для неизвестных планов
  console.warn(`[getUserPlan] Unknown plan "${plan}", falling back to "trial"`);
  return "trial";
}

/**
 * Проверяет, является ли план "премиальным" (не trial/basic)
 */
export function isPremiumPlan(plan: UserPlan): boolean {
  return plan === "professional" || plan === "enterprise";
}
