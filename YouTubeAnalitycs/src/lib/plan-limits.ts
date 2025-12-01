export const PLAN_LIMITS = {
  free: 3,
  basic: 3,
  professional: 20,
  enterprise: 200,
} as const;

export type PlanId = keyof typeof PLAN_LIMITS;
