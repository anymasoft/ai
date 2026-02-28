/**
 * PricingPlans — карточки тарифов для LibreChat
 * Адаптировано из YouTubeScripts/src/components/pricing-plans.tsx
 *
 * Режим 'pricing' — лендинг (кнопки триггерят оплату)
 * Режим 'billing' — страница биллинга (показывает текущий пакет)
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '~/hooks';

export interface PricingPlan {
  id: string;
  name: string;
  description: string;
  price: string;
  priceNote: string;
  tokenCredits: number;
  features: string[];
  highlight?: boolean;
  badge?: string | null;
}

interface PricingPlansProps {
  mode?: 'pricing' | 'billing';
  currentBalance?: number; // tokenCredits пользователя
  onPaymentStart?: () => void;
}

const PLANS: PricingPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'Для знакомства с сервисом',
    price: '990 ₽',
    priceNote: 'разовый пакет',
    tokenCredits: 400_000,
    features: [
      'GPT-4o Mini',
      'Claude Sonnet',
      'DeepSeek V3',
      'Web-поиск (Tavily)',
      '400 000 токен-кредитов',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Для регулярной работы',
    price: '1 990 ₽',
    priceNote: 'разовый пакет',
    tokenCredits: 900_000,
    features: [
      'GPT-4o Mini',
      'Claude Sonnet',
      'DeepSeek V3',
      'Web-поиск (Tavily)',
      'Code Interpreter',
      '900 000 токен-кредитов',
    ],
    highlight: true,
    badge: 'РЕКОМЕНДУЕМ',
  },
  {
    id: 'max',
    name: 'Max',
    description: 'Максимальный объём',
    price: '3 990 ₽',
    priceNote: 'разовый пакет',
    tokenCredits: 2_000_000,
    features: [
      'GPT-4o Mini',
      'Claude Sonnet',
      'DeepSeek V3',
      'Web-поиск (Tavily)',
      'Code Interpreter',
      'Приоритетная поддержка (email)',
      '2 000 000 токен-кредитов',
    ],
  },
];

export default function PricingPlans({ mode = 'pricing', onPaymentStart }: PricingPlansProps) {
  const navigate = useNavigate();
  const { token } = useAuthContext();
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleBuy = async (packageId: string) => {
    if (mode === 'pricing') {
      navigate('/pricing');
      return;
    }
    try {
      setError(null);
      setLoadingPlanId(packageId);
      onPaymentStart?.();

      const res = await fetch('/api/payment/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ packageId }),
        credentials: 'include',
      });
      const data = await res.json();
      if (data.confirmationUrl) {
        window.location.href = data.confirmationUrl;
      } else {
        setError(data.error || 'Ошибка при создании платежа');
      }
    } catch {
      setError('Ошибка соединения с сервером');
    } finally {
      setLoadingPlanId(null);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`relative flex flex-col rounded-2xl p-6 ${
              plan.highlight
                ? 'border-2 border-blue-500 bg-white shadow-lg dark:bg-gray-800'
                : 'border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
            }`}
          >
            {plan.badge && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-500 px-3 py-1 text-xs font-semibold text-white">
                {plan.badge}
              </div>
            )}

            <div className="mb-4 text-center">
              <h3 className="mb-1 text-xl font-semibold text-gray-900 dark:text-white">
                {plan.name}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">{plan.description}</p>
            </div>

            <div className="mb-5 text-center">
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{plan.price}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">{plan.priceNote}</p>
            </div>

            <ul className="mb-6 flex-1 space-y-2">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <span className="mt-0.5 shrink-0 text-green-500">✓</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleBuy(plan.id)}
              disabled={loadingPlanId === plan.id}
              className={`w-full rounded-xl py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
                plan.highlight
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-900 text-white hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200'
              }`}
            >
              {loadingPlanId === plan.id ? 'Загрузка...' : 'Купить'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
