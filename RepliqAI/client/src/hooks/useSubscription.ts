import { useQuery } from '@tanstack/react-query';
import { useAuthContext } from './AuthContext';

export interface Subscription {
  planId: 'free' | 'pro' | 'business';
  planKey: string;
  planName: string;
  description: string;
  expiresAt: string | null;
  allowedModels: string[];
  allowedSpecs: string[];
  tokenCreditsOnPurchase: number;
  durationDays: number | null;
  isActive: boolean;
  features: {
    webSearch: boolean;
    codeInterpreter: boolean;
    prioritySupport: boolean;
  };
}

/**
 * useSubscription — Единый источник истины для информации о тарифе пользователя
 *
 * ✅ SSOT (Single Source of Truth): только один endpoint, только одна точка кэша
 * ✅ staleTime=0: данные всегда считаются устаревшими, чтобы браузер не кэшировал
 * ✅ refetchOnWindowFocus=true: пересчитаем при фокусе на окно (актуально для мультивкладочности)
 *
 * Использование:
 * const { data: subscription, isLoading } = useSubscription();
 * subscription.planId → 'pro'
 * subscription.allowedModels → ['gpt-4o', 'claude-opus', ...]
 * subscription.features.webSearch → true
 */
export function useSubscription() {
  const { token } = useAuthContext();

  return useQuery<Subscription>({
    queryKey: ['subscription'],
    queryFn: async (): Promise<Subscription> => {
      if (!token) {
        throw new Error('No authentication token');
      }

      const response = await fetch('/api/user/subscription', {
        method: 'GET',
        credentials: 'include',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch subscription: ${response.statusText}`);
      }

      return response.json();
    },
    enabled: !!token,
    // ✅ SSOT ключ настройки:
    staleTime: 0,              // Данные ВСЕГДА считаются неактуальными
    gcTime: 5 * 60 * 1000,     // Но в памяти их держим 5 минут для скорости
    refetchOnWindowFocus: true, // Пересчитаем при фокусе (мультивкладочность)
    refetchOnMount: true,       // Пересчитаем если компонент заново смонтирован
    retry: 2,                   // 2 повтора при ошибке
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

export default useSubscription;
