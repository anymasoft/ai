/**
 * Конфигурация лимитов по тарифам
 * ИСТОЧНИК ИСТИНЫ для лимитов проверок описаний товаров и других возможностей
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
    monthlyScriptLimit: 10,
    description: 'Для знакомства с сервисом',
  },
  basic: {
    id: 'basic',
    name: 'Basic',
    price: '490 ₽',
    monthlyScriptLimit: 50,
    description: 'Для продавцов одного товара',
  },
  professional: {
    id: 'professional',
    name: 'Professional',
    price: '1 290 ₽',
    monthlyScriptLimit: 200,
    description: 'Для интернет-магазинов',
  },
  enterprise: {
    id: 'enterprise',
    name: 'Enterprise',
    price: '4 990 ₽',
    monthlyScriptLimit: 1000,
    description: 'Для больших каталогов',
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
