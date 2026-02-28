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

  // Не показываем: pro-пользователям, задисмиссенным, незалогиненным
  if (!isAuthenticated || isPro || dismissed) {
    return null;
  }

  const credits = (balanceData as { tokenCredits?: number } | undefined)?.tokenCredits ?? null;
  const lowBalance = balanceEnabled && credits !== null && credits < 5000;

  const message = lowBalance
    ? `Баланс почти на нуле (${credits?.toLocaleString('ru')} кр.). Пополните для продолжения.`
    : 'GPT-4o Mini — бесплатно. Claude Sonnet, DeepSeek, Web-поиск — в Pro';

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, 'true');
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  return (
    <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-2 text-sm text-white">
      <span className="font-medium">{message}</span>
      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={() => navigate('/pricing')}
          className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-colors"
        >
          Купить Pro
        </button>
        <button
          onClick={handleDismiss}
          className="text-lg leading-none text-blue-200 hover:text-white transition-colors"
          aria-label="Закрыть"
        >
          ×
        </button>
      </div>
    </div>
  );
}
