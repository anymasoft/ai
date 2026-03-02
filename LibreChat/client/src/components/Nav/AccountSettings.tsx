import { useState, memo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Select from '@ariakit/react/select';
import { useQuery } from '@tanstack/react-query';
import { FileText, LogOut, CreditCard, ShieldCheck } from 'lucide-react';
import { LinkIcon, GearIcon, DropdownMenuSeparator, Avatar } from '@librechat/client';
import { MyFilesModal } from '~/components/Chat/Input/Files/MyFilesModal';
import { useGetStartupConfig, useGetUserBalance } from '~/data-provider';
import { useAuthContext } from '~/hooks/AuthContext';
import { useLocalize } from '~/hooks';
import Settings from './Settings';

const PLAN_BADGE: Record<string, { label: string; className: string }> = {
  free:     { label: 'Free',     className: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
  pro:      { label: 'Pro',      className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  business: { label: 'Business', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
};

function AccountSettings() {
  const localize = useLocalize();
  const navigate = useNavigate();
  const { user, token, isAuthenticated, logout } = useAuthContext();
  const { data: startupConfig } = useGetStartupConfig();
  const balanceQuery = useGetUserBalance({
    enabled: !!isAuthenticated && startupConfig?.balance?.enabled,
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showFiles, setShowFiles] = useState(false);
  const accountSettingsButtonRef = useRef<HTMLButtonElement>(null);

  const { data: planData } = useQuery({
    queryKey: ['allowedModels', token],
    queryFn: async (): Promise<{ models: unknown[]; plan: string }> => {
      const res = await fetch('/api/models/allowed', {
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch allowed models');
      const data = await res.json();
      return { ...data, plan: data.plan || 'free' };
    },
    staleTime: 60_000,
    gcTime: 60_000,
    enabled: !!token && isAuthenticated,
  });
  const planBadge = planData && PLAN_BADGE[planData.plan];

  return (
    <Select.SelectProvider>
      <Select.Select
        ref={accountSettingsButtonRef}
        aria-label={localize('com_nav_account_settings')}
        data-testid="nav-user"
        className="mt-text-sm flex h-auto w-full items-center gap-2 rounded-xl p-2 text-sm transition-all duration-200 ease-in-out hover:bg-surface-active-alt aria-[expanded=true]:bg-surface-active-alt"
      >
        <div className="-ml-0.9 -mt-0.8 h-8 w-8 flex-shrink-0">
          <div className="relative flex">
            <Avatar user={user} size={32} />
          </div>
        </div>
        <div
          className="mt-2 grow overflow-hidden text-ellipsis whitespace-nowrap text-left text-text-primary"
          style={{ marginTop: '0', marginLeft: '0' }}
        >
          {user!.name}
        </div>
      </Select.Select>
      <Select.SelectPopover
        className="account-settings-popover popover-ui z-[125] w-[305px] rounded-lg md:w-[244px]"
        style={{
          transformOrigin: 'bottom',
          translate: '0 -4px',
        }}
      >
        <div className="text-token-text-secondary ml-3 mr-2 py-2 text-sm" role="note">
          {user!.email}
        </div>
        <DropdownMenuSeparator />
        <Select.SelectItem
          value=""
          onClick={() => navigate('/pricing')}
          className="select-item text-sm text-blue-600 dark:text-blue-400"
        >
          <CreditCard className="icon-md" aria-hidden="true" />
          <span className="flex flex-1 items-center justify-between gap-2">
            <span>Баланс</span>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${planBadge.className}`}>
              {planBadge.label}
            </span>
          </span>
        </Select.SelectItem>
        <DropdownMenuSeparator />
        {user!.role === 'ADMIN' && (
          <>
            <Select.SelectItem
              value=""
              onClick={() => navigate('/admin')}
              className="select-item text-sm"
            >
              <ShieldCheck className="icon-md" aria-hidden="true" />
              Панель администратора
            </Select.SelectItem>
            <DropdownMenuSeparator />
          </>
        )}
        <Select.SelectItem
          value=""
          onClick={() => setShowFiles(true)}
          className="select-item text-sm"
        >
          <FileText className="icon-md" aria-hidden="true" />
          {localize('com_nav_my_files')}
        </Select.SelectItem>
        <Select.SelectItem
          value=""
          onClick={() => window.open(startupConfig?.helpAndFaqURL, '_blank')}
          className="select-item text-sm"
        >
          <LinkIcon aria-hidden="true" />
          {localize('com_nav_help_faq')}
        </Select.SelectItem>
        <Select.SelectItem
          value=""
          onClick={() => setShowSettings(true)}
          className="select-item text-sm"
        >
          <GearIcon className="icon-md" aria-hidden="true" />
          {localize('com_nav_settings')}
        </Select.SelectItem>
        <DropdownMenuSeparator />
        <Select.SelectItem
          aria-selected={true}
          onClick={() => logout()}
          value="logout"
          className="select-item text-sm"
        >
          <LogOut className="icon-md" aria-hidden="true" />
          {localize('com_nav_log_out')}
        </Select.SelectItem>
      </Select.SelectPopover>
      {showFiles && (
        <MyFilesModal
          open={showFiles}
          onOpenChange={setShowFiles}
          triggerRef={accountSettingsButtonRef}
        />
      )}
      {showSettings && <Settings open={showSettings} onOpenChange={setShowSettings} />}
    </Select.SelectProvider>
  );
}

export default memo(AccountSettings);
