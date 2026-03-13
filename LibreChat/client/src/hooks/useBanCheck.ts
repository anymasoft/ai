import { useState, useCallback } from 'react';
import { useRecoilState } from 'recoil';
import store from '~/store';

/**
 * Hook для проверки ban статуса пользователя
 *
 * Обрабатывает ошибки USER_BANNED от API
 * и устанавливает isBanned state.
 *
 * Не делает redirect - это обрабатывается через компонент BannedUserNotification.
 */
export const useBanCheck = () => {
  const [isBanned, setIsBanned] = useRecoilState(store.isBanned);
  const [isCheckingBan, setIsCheckingBan] = useState(false);

  /**
   * Установить ban статус пользователя
   */
  const setBannedStatus = useCallback((banned: boolean) => {
    setIsBanned(banned);
  }, [setIsBanned]);

  /**
   * Обработать USER_BANNED ошибку от API
   */
  const handleBanError = useCallback((error: unknown) => {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'USER_BANNED'
    ) {
      setIsBanned(true);
      return true;
    }
    return false;
  }, [setIsBanned]);

  /**
   * Проверить ban статус у API
   */
  const checkBanStatus = useCallback(async () => {
    setIsCheckingBan(true);
    try {
      const response = await fetch('/api/auth/user', {
        method: 'GET',
        credentials: 'include',
      });

      if (response.status === 403) {
        const data = await response.json();
        if (data.code === 'USER_BANNED') {
          setIsBanned(true);
          return true;
        }
      }

      setIsBanned(false);
      return false;
    } catch (error) {
      console.error('Error checking ban status:', error);
      return false;
    } finally {
      setIsCheckingBan(false);
    }
  }, [setIsBanned]);

  return {
    isBanned,
    isCheckingBan,
    setBannedStatus,
    handleBanError,
    checkBanStatus,
  };
};

export default useBanCheck;
