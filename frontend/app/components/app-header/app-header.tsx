import { NavLink } from 'react-router';
import {
  IconHome2,
  IconLogout,
  IconAddressBook,
  IconCalendarEvent,
  IconForms,
  IconSettings,
  IconUser,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useUserState } from '@internal/core/states/use-user-state';
import { useLogout } from '../../modules/auth/use-logout';
import { AdminGuard } from '../admin-guard';
import { BrandMark, ThemeToggle } from '@internal/ui';
import { NotificationBell } from '../notification-bell';

const navClass = ({ isActive }: { isActive: boolean }) =>
  [
    'inline-flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium whitespace-nowrap transition-colors lg:px-3',
    isActive
      ? 'bg-accent text-accent-foreground'
      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
  ].join(' ');

export function AppHeader() {
  const { t } = useTranslation('menu');
  const { user } = useUserState();
  const handleLogout = useLogout();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <BrandMark href="/app" />

          <nav className="hidden items-center gap-1 md:flex">
            <NavLink to="/app" end className={navClass}>
              <IconHome2 size={17} stroke={1.8} />
              {t('dashboard')}
            </NavLink>
            <NavLink to="/app/pages" className={navClass}>
              <IconAddressBook size={17} stroke={1.8} />
              {t('pages')}
            </NavLink>
            <NavLink to="/app/forms" className={navClass}>
              <IconForms size={17} stroke={1.8} />
              {t('forms')}
            </NavLink>

            <NavLink to="/app/agenda" className={navClass}>
              <IconCalendarEvent size={17} stroke={1.8} />
              {t('agenda')}
            </NavLink>

            {/* One entry for every admin section; /admin lists them. */}
            <AdminGuard>
              <NavLink to="/admin" className={navClass}>
                <IconSettings size={17} stroke={1.8} />
                {t('admin')}
              </NavLink>
            </AdminGuard>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <NotificationBell />
          <ThemeToggle />
          {user && (
            <NavLink
              to="/app/account"
              title={user.email}
              aria-label={t('my_account')}
              className={({ isActive }) =>
                [
                  'inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'border-transparent bg-accent text-accent-foreground'
                    : 'border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                ].join(' ')
              }
            >
              <IconUser size={17} stroke={1.8} />
              <span className="hidden lg:inline">{t('my_account')}</span>
            </NavLink>
          )}
          <button
            type="button"
            onClick={handleLogout}
            aria-label={t('logout')}
            className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10"
          >
            <IconLogout size={17} stroke={1.8} />
            <span className="hidden lg:inline">{t('logout')}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
