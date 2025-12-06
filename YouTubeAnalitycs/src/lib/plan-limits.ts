export const PLAN_LIMITS = {
  free: 10,  // Временно увеличен с 3 до 10 для тестирования
  basic: 3,
  professional: 20,
  enterprise: 200,
} as const;

export type PlanId = keyof typeof PLAN_LIMITS;
