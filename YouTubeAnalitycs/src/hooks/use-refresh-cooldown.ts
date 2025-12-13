import { useState, useEffect, useCallback } from 'react';
import type { UserPlan } from '@/config/limits';

interface UseRefreshCooldownOptions {
  userPlan: UserPlan;
  cooldownMs?: number;
}

interface RefreshCooldownState {
  isOnCooldown: boolean;
  secondsRemaining: number;
}

interface UseRefreshCooldownReturn {
  isOnCooldown: boolean;
  secondsRemaining: number;
  startCooldown: () => void;
  isFreePlan: boolean;
  getTooltipText: (customText?: string) => string;
}

const REFRESH_COOLDOWN_MS = 60000; // 60 seconds

/**
 * Hook для управления таймером обновления кнопок
 * Для платных пользователей: 60 сек cooldown после клика
 * Для free пользователей: всегда недоступно
 */
export function useRefreshCooldown(
  options: UseRefreshCooldownOptions
): UseRefreshCooldownReturn {
  const { userPlan, cooldownMs = REFRESH_COOLDOWN_MS } = options;
  const isFreePlan = userPlan === 'free';

  const [isOnCooldown, setIsOnCooldown] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(0);

  // Таймер для отсчета секунд
  useEffect(() => {
    if (!isOnCooldown) {
      setSecondsRemaining(0);
      return;
    }

    const startTime = Date.now();
    const endTime = startTime + cooldownMs;

    const timer = setInterval(() => {
      const remaining = Math.max(0, endTime - Date.now());
      const seconds = Math.ceil(remaining / 1000);

      setSecondsRemaining(seconds);

      if (remaining <= 0) {
        setIsOnCooldown(false);
        setSecondsRemaining(0);
      }
    }, 100); // Обновляем каждые 100ms для плавности

    return () => clearInterval(timer);
  }, [isOnCooldown, cooldownMs]);

  // Запустить cooldown
  const startCooldown = useCallback(() => {
    if (!isFreePlan) {
      setIsOnCooldown(true);
      setSecondsRemaining(Math.ceil(cooldownMs / 1000));
    }
  }, [isFreePlan, cooldownMs]);

  // Текст для tooltip
  const getTooltipText = useCallback((customText: string = 'Обновить данные') => {
    if (isFreePlan) {
      return 'Недоступно на бесплатном тарифе';
    }
    if (isOnCooldown) {
      return `Данные обновляются. Повторно можно через ${secondsRemaining} сек.`;
    }
    return customText;
  }, [isFreePlan, isOnCooldown, secondsRemaining]);

  return {
    isOnCooldown,
    secondsRemaining,
    startCooldown,
    isFreePlan,
    getTooltipText,
  };
}
