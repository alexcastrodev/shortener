import { NavLink } from 'react-router';
import { IconHome2, IconLogout, IconAddressBook, IconSettings } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useUserState } from '@internal/core/states/use-user-state';
import { useLogout } from '../../modules/auth/use-logout';
import { AdminGuard } from '../admin-guard';
import { BrandMark, ThemeToggle } from '@internal/ui';

const navClass = ({ isActive }: { isActive: boolean }) =>
  [
    'inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-accent text-accent-foreground'
      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
  ].join(' ');

export function AppHeader() {
  const { t } = useTranslation('menu');
  const { user } = useUserState();
  const handleLogout = useLogout();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <BrandMark href="/app" />

          <nav className="hidden items-center gap-1 sm:flex">
            <NavLink to="/app" end className={navClass}>
              <IconHome2 size={17} stroke={1.8} />
              {t('dashboard')}
            </NavLink>
            <NavLink to="/app/pages" className={navClass}>
              <IconAddressBook size={17} stroke={1.8} />
              {t('pages')}
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
          <ThemeToggle />
          {user && (
            <span className="hidden text-sm text-muted-foreground lg:inline">
              {user.email}
            </span>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10"
          >
            <IconLogout size={17} stroke={1.8} />
            <span className="hidden sm:inline">{t('logout')}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
