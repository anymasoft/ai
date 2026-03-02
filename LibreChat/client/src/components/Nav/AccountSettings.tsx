import { useState, memo, useRef } from 'react';
import * as Menu from '@ariakit/react/menu';
import { FileText, LogOut, ShieldCheck } from 'lucide-react';
import { LinkIcon, GearIcon, DropdownMenuSeparator, Avatar } from '@librechat/client';
import { MyFilesModal } from '~/components/Chat/Input/Files/MyFilesModal';
import { useGetStartupConfig, useGetUserBalance } from '~/data-provider';
import { useAuthContext } from '~/hooks/AuthContext';
import { useLocalize } from '~/hooks';
import Settings from './Settings';
import { useQuery } from '@tanstack/react-query';

const PLAN_BADGE: Record<string, { label: string; className: string }> = {
  free:     { label: 'Free',     className: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
  pro:      { label: 'Pro',      className: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  business: { label: 'Business', className: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300' },
};

function AccountSettings() {
  const localize = useLocalize();
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
    queryFn: async (): Promise<{ models: unknown[]; plan: string } | null> => {
      if (!token) return null;
      const res = await fetch('/api/models/allowed', {
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 60_000,
    gcTime: 60_000,
    enabled: !!token,
  });
  const planBadge = PLAN_BADGE[planData?.plan ?? ''] ?? null;

  return (
    <Menu.MenuProvider>
      <Menu.MenuButton
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
          {user?.name ?? user?.username ?? localize('com_nav_user')}
        </div>
      </Menu.MenuButton>
      <Menu.Menu
        className="account-settings-popover popover-ui z-[125] w-[305px] rounded-lg md:w-[244px]"
        style={{
          transformOrigin: 'bottom',
          translate: '0 -4px',
        }}
      >
        <div className="text-token-text-secondary ml-3 mr-2 py-2 text-sm" role="note">
          {user?.email ?? localize('com_nav_user')}
        </div>
        <DropdownMenuSeparator />
        {startupConfig?.balance?.enabled === true && balanceQuery.data != null && (
          <>
            <div className="ml-3 mr-2 flex items-center justify-between gap-2 py-2">
              <span className="text-token-text-secondary text-sm">
                {localize('com_nav_balance')}:{' '}
                {new Intl.NumberFormat().format(Math.round(balanceQuery.data.tokenCredits))}
              </span>
              {planBadge && (
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${planBadge.className}`}>
                  {planBadge.label}
                </span>
              )}
            </div>
            <DropdownMenuSeparator />
          </>
        )}
        {user?.role === 'ADMIN' && (
          <>
            <Menu.MenuItem onClick={() => window.location.href = '/admin'} className="select-item text-sm">
              <ShieldCheck className="icon-md" aria-hidden="true" />
              Панель администратора
            </Menu.MenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <Menu.MenuItem onClick={() => setShowFiles(true)} className="select-item text-sm">
          <FileText className="icon-md" aria-hidden="true" />
          {localize('com_nav_my_files')}
        </Menu.MenuItem>
        {startupConfig?.helpAndFaqURL !== '/' && (
          <Menu.MenuItem
            onClick={() => window.open(startupConfig?.helpAndFaqURL, '_blank')}
            className="select-item text-sm"
          >
            <LinkIcon aria-hidden="true" />
            {localize('com_nav_help_faq')}
          </Menu.MenuItem>
        )}
        <Menu.MenuItem onClick={() => setShowSettings(true)} className="select-item text-sm">
          <GearIcon className="icon-md" aria-hidden="true" />
          {localize('com_nav_settings')}
        </Menu.MenuItem>
        <DropdownMenuSeparator />
        <Menu.MenuItem onClick={() => logout()} className="select-item text-sm">
          <LogOut className="icon-md" aria-hidden="true" />
          {localize('com_nav_log_out')}
        </Menu.MenuItem>
      </Menu.Menu>
      {showFiles && (
        <MyFilesModal
          open={showFiles}
          onOpenChange={setShowFiles}
          triggerRef={accountSettingsButtonRef}
        />
      )}
      {showSettings && <Settings open={showSettings} onOpenChange={setShowSettings} />}
    </Menu.MenuProvider>
  );
}

export default memo(AccountSettings);
