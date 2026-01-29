/**
 * Конфигурация лимитов по тарифам
 * ИСТОЧНИК ИСТИНЫ для лимитов сценариев и других возможностей
 */

export type PlanType = 'trial' | 'basic' | 'professional' | 'enterprise' | 'expired';

export interface PlanLimits {
  id: PlanType;
  name: string;
  price: string;
  monthlyScriptLimit: number;
  description: string;
}

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  trial: {
    id: 'trial',
    name: 'Trial',
    price: '0 ₽',
    monthlyScriptLimit: 50,
    description: 'Пробный доступ на 3 дня',
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
  expired: {
    id: 'expired',
    name: 'Expired',
    price: 'Подписка истекла',
    monthlyScriptLimit: 0,
    description: 'Подписка истекла. Пожалуйста, выберите новый тариф.',
  },
};

/**
 * Получить лимит сценариев для плана
 */
export function getMonthlyScriptLimit(plan: PlanType): number {
  return PLAN_LIMITS[plan]?.monthlyScriptLimit || 0;
}

/**
 * Получить информацию о плане
 */
export function getPlanInfo(plan: PlanType): PlanLimits {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.trial;
}
