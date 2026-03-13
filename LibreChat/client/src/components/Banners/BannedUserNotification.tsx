import { useCallback } from 'react';
import { LogOut } from 'lucide-react';
import { Button, cn } from '@librechat/client';
import { useAuthContext } from '~/hooks/AuthContext';

interface BannedUserNotificationProps {
  isVisible: boolean;
  onClose?: () => void;
}

/**
 * Уведомление для забаненного пользователя
 *
 * Отображает красивое модальное уведомление (не alert)
 * когда пользователь забанен администратором.
 *
 * Требует:
 * - useAuthContext для функции logout
 */
export const BannedUserNotification = ({
  isVisible,
  onClose,
}: BannedUserNotificationProps) => {
  const { logout } = useAuthContext();

  const handleLogout = useCallback(() => {
    logout('/');
  }, [logout]);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className={cn(
          'w-full max-w-md rounded-lg bg-surface p-6 shadow-xl',
          'border border-red-500/20 border-l-4 border-l-red-500',
          'animate-in fade-in slide-in-from-bottom-4 duration-300'
        )}
        role="alert"
        aria-live="assertive"
      >
        {/* Иконка */}
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
          <div className="h-6 w-6 rounded-full border-2 border-red-500" />
        </div>

        {/* Заголовок */}
        <h2 className="text-lg font-semibold text-text-primary">
          Account Suspended
        </h2>

        {/* Описание */}
        <p className="mt-2 text-sm text-text-secondary">
          Your account has been blocked by the administrator. If you believe this is a mistake, please contact our support team.
        </p>

        {/* Кнопка выхода */}
        <div className="mt-6 flex gap-2">
          <Button
            onClick={handleLogout}
            variant="destructive"
            className="flex-1 gap-2"
          >
            <LogOut className="h-4 w-4" />
            Log Out
          </Button>
        </div>

        {/* Дополнительная информация */}
        <div className="mt-4 rounded-md bg-neutral-500/5 p-3">
          <p className="text-xs text-text-secondary">
            Support Email:{' '}
            <a
              href="mailto:support@librechat.local"
              className="font-medium text-blue-500 hover:underline"
            >
              support@librechat.local
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default BannedUserNotification;
