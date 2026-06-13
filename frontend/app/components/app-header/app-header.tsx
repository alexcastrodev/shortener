import { NavLink, useNavigate } from 'react-router';
import { IconHome2, IconLogout, IconUsers, IconLink } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useUserState } from '@internal/core/states/use-user-state';
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
  const navigate = useNavigate();
  const { t } = useTranslation('menu');
  const { clear } = useUserState();

  const handleLogout = () => {
    clear();
    navigate('/login');
  };

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

            <AdminGuard>
              <NavLink to="/admin/users" className={navClass}>
                <IconUsers size={17} stroke={1.8} />
                {t('users')}
              </NavLink>
              <NavLink to="/admin/shortlinks" className={navClass}>
                <IconLink size={17} stroke={1.8} />
                {t('shortlinks')}
              </NavLink>
            </AdminGuard>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
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
