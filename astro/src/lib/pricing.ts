/**
 * Единый источник данных для тарифов
 * Используется и на лендинге, и на странице /billing
 */

export interface PricingPlan {
  id: string;
  name: string;
  credits: number;
  price: number;
  pricePerCredit: number;
  popular: boolean;
  isCustom: boolean;
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'custom',
    name: 'Разовая покупка',
    credits: 1, // будет менять пользователь
    price: 89, // будет пересчитываться
    pricePerCredit: 89,
    popular: false,
    isCustom: true
  },
  {
    id: 'free',
    name: 'Пробный',
    credits: 3,
    price: 0,
    pricePerCredit: 0,
    popular: false,
    isCustom: false
  },
  {
    id: 'basic',
    name: 'Basic',
    credits: 50,
    price: 3950,
    pricePerCredit: 79,
    popular: true,
    isCustom: false
  },
  {
    id: 'professional',
    name: 'Professional',
    credits: 200,
    price: 13800,
    pricePerCredit: 69,
    popular: false,
    isCustom: false
  }
];

/**
 * Форматирование цены в рубли с разделением по тысячам
 */
export function formatPrice(price: number): string {
  return price.toLocaleString('ru-RU');
}

/**
 * Получение только покупаемых тарифов (исключая custom для лендинга)
 */
export function getPlansSummary(): Pick<PricingPlan, 'id' | 'name' | 'credits' | 'price' | 'pricePerCredit' | 'popular'>[] {
  return PRICING_PLANS.filter(plan => !plan.isCustom);
}
