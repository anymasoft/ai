/**
 * Утилиты для работы с тарифными планами пользователей
 */

import type { Session } from "next-auth";
import type { UserPlan } from "@/config/limits";

/**
 * Получает план пользователя из сессии
 * По умолчанию возвращает "free" если план не определён
 */
export function getUserPlan(session: Session | null): UserPlan {
  if (!session?.user?.plan) {
    return "free";
  }

  const plan = session.user.plan;

  // Проверяем что план валидный
  if (plan === "free" || plan === "basic" || plan === "professional" || plan === "enterprise") {
    return plan;
  }

  // Fallback на free для неизвестных планов
  console.warn(`[getUserPlan] Unknown plan "${plan}", falling back to "free"`);
  return "free";
}

/**
 * Проверяет, является ли план "премиальным" (не free/basic)
 */
export function isPremiumPlan(plan: UserPlan): boolean {
  return plan === "professional" || plan === "enterprise";
}
