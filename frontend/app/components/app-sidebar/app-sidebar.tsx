import { NavLink } from 'react-router';
import {
  IconAddressBook,
  IconCalendarEvent,
  IconForms,
  IconHome2,
  IconLogout,
  IconSettings,
  IconUser,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useComputedColorScheme, useMantineColorScheme } from '@mantine/core';
import { IconMoon, IconSun } from '@tabler/icons-react';
import { BrandMark } from '@internal/ui';
import { useUserState } from '@internal/core/states/use-user-state';
import { useLogout } from '../../modules/auth/use-logout';
import { AdminGuard } from '../admin-guard';
import { NotificationBell } from '../notification-bell';

const itemClass = ({ isActive }: { isActive: boolean }) =>
  [
    'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-accent text-accent-foreground'
      : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
  ].join(' ');

export function AppSidebar() {
  const { t } = useTranslation('menu');
  const { setColorScheme } = useMantineColorScheme();
  const isDark = useComputedColorScheme('light') === 'dark';
  const ThemeIcon = isDark ? IconSun : IconMoon;
  const { user } = useUserState();
  const handleLogout = useLogout();

  return (
    <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col gap-5 border-r border-border bg-background px-3.5 py-4 lg:flex xl:w-60">
      <div className="px-1.5">
        <BrandMark href="/app" />
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
        <NavLink to="/app" end className={itemClass}>
          <IconHome2 size={17} stroke={1.8} />
          {t('dashboard')}
        </NavLink>
        <NavLink to="/app/pages" className={itemClass}>
          <IconAddressBook size={17} stroke={1.8} />
          {t('pages')}
        </NavLink>
        <NavLink to="/app/forms" className={itemClass}>
          <IconForms size={17} stroke={1.8} />
          {t('forms')}
        </NavLink>
        <NavLink to="/app/agenda" className={itemClass}>
          <IconCalendarEvent size={17} stroke={1.8} />
          {t('agenda')}
        </NavLink>
        <AdminGuard>
          <NavLink to="/admin" className={itemClass}>
            <IconSettings size={17} stroke={1.8} />
            {t('admin')}
          </NavLink>
        </AdminGuard>
      </nav>

      <div className="flex flex-col gap-0.5 border-t border-border pt-3">
        <NotificationBell withLabel />
        <button
          type="button"
          onClick={() => setColorScheme(isDark ? 'light' : 'dark')}
          className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <ThemeIcon size={17} stroke={1.8} />
          {isDark ? t('theme_light') : t('theme_dark')}
        </button>
        {user && (
          <NavLink to="/app/account" title={user.email} className={itemClass}>
            <IconUser size={17} stroke={1.8} />
            {t('my_account')}
          </NavLink>
        )}
        <button
          type="button"
          onClick={handleLogout}
          className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10"
        >
          <IconLogout size={17} stroke={1.8} />
          {t('logout')}
        </button>
      </div>
    </aside>
  );
}
