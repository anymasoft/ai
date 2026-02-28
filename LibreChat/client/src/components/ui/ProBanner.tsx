import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SystemRoles } from 'librechat-data-provider';
import { useAuthContext } from '~/hooks';
import { useGetStartupConfig, useGetUserBalance } from '~/data-provider';

const DISMISS_KEY = 'pro_banner_dismissed_v1';

export default function ProBanner() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthContext();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const { data: startupConfig } = useGetStartupConfig();
  const balanceEnabled = startupConfig?.balance?.enabled ?? false;

  const { data: balanceData } = useGetUserBalance({
    enabled: isAuthenticated && balanceEnabled,
  });

  const isPro = user?.role === SystemRoles.ADMIN;
  const credits = (balanceData as { tokenCredits?: number } | undefined)?.tokenCredits ?? null;

  // Не показываем: pro-пользователям, задисмиссенным, незалогиненным
  if (!isAuthenticated || isPro || dismissed) {
    return null;
  }

  // Показываем баннер если баланс не включён или кредиты кончаются
  const lowBalance = balanceEnabled && credits !== null && credits < 5000;
  const showBanner = !balanceEnabled || lowBalance;

  if (!showBanner) {
    return null;
  }

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, 'true');
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-500 text-white text-sm">
      <span className="font-medium">
        {lowBalance
          ? `⚡ Баланс заканчивается (${credits?.toLocaleString('ru')} кредитов). Пополните для продолжения.`
          : '🚀 Разблокируйте Claude Sonnet, DeepSeek и Web-поиск — перейдите на Pro'}
      </span>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => navigate('/pricing')}
          className="px-3 py-1 bg-white text-blue-600 rounded-full text-xs font-semibold hover:bg-blue-50 transition-colors"
        >
          Купить Pro
        </button>
        <button
          onClick={handleDismiss}
          className="text-blue-200 hover:text-white transition-colors text-lg leading-none"
          aria-label="Закрыть"
        >
          ×
        </button>
      </div>
    </div>
  );
}
