/**
 * Конфигурация лимитов по тарифам
 * ИСТОЧНИК ИСТИНЫ для лимитов проверок и других возможностей
 */

export type PlanType = 'free' | 'basic' | 'professional' | 'enterprise';

export interface PlanLimits {
  id: PlanType;
  name: string;
  price: string;
  monthlyScriptLimit: number;
  description: string;
}

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  free: {
    id: 'free',
    name: 'Free',
    price: '0 ₽',
    monthlyScriptLimit: 3,
    description: 'Для знакомства с сервисом',
  },
  basic: {
    id: 'basic',
    name: 'Basic',
    price: '990 ₽',
    monthlyScriptLimit: 30,
    description: 'Для начинающих авторов',
  },
  professional: {
    id: 'professional',
    name: 'Professional',
    price: '2 490 ₽',
    monthlyScriptLimit: 100,
    description: 'Для растущих каналов',
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    price: '5 990 ₽',
    monthlyScriptLimit: 300,
    description: 'Для студий и команд',
  },
};

/**
 * Получить лимит проверок для плана
 */
export function getMonthlyScriptLimit(plan: PlanType): number {
  return PLAN_LIMITS[plan]?.monthlyScriptLimit || 0;
}

/**
 * Получить информацию о плане
 */
export function getPlanInfo(plan: PlanType): PlanLimits {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.free;
}
