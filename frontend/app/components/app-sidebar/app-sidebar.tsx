import { useState } from 'react';
import { NavLink } from 'react-router';
import {
  IconAddressBook,
  IconCalendarEvent,
  IconForms,
  IconHome2,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconLogout,
  IconMoon,
  IconSettings,
  IconSun,
  IconUser,
} from '@tabler/icons-react';
import { useComputedColorScheme, useMantineColorScheme } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { BrandMark } from '@internal/ui';
import { useUserState } from '@internal/core/states/use-user-state';
import { useLogout } from '../../modules/auth/use-logout';
import { AdminGuard } from '../admin-guard';
import { NotificationBell } from '../notification-bell';

const storageKey = 'kurz:sidebar-collapsed';

const readCollapsed = () => {
  try {
    return localStorage.getItem(storageKey) === '1';
  } catch {
    return false;
  }
};

const rowClass = (collapsed: boolean) =>
  `flex items-center rounded-md py-2 text-sm font-medium transition-colors ${collapsed ? 'justify-center px-2' : 'gap-2.5 px-2.5'}`;

export function AppSidebar() {
  const { t } = useTranslation('menu');
  const { setColorScheme } = useMantineColorScheme();
  const isDark = useComputedColorScheme('light') === 'dark';
  const ThemeIcon = isDark ? IconSun : IconMoon;
  const { user } = useUserState();
  const handleLogout = useLogout();
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(storageKey, next ? '1' : '0');
    } catch {
      return;
    }
  };

  const itemClass = ({ isActive }: { isActive: boolean }) =>
    `${rowClass(collapsed)} ${
      isActive
        ? 'bg-accent text-accent-foreground'
        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
    }`;

  const text = (label: string) => (collapsed ? null : label);
  const tip = (label: string) => (collapsed ? label : undefined);
  const themeLabel = isDark ? t('theme_light') : t('theme_dark');
  const toggleLabel = collapsed ? t('expand_menu') : t('collapse_menu');
  const ToggleIcon = collapsed
    ? IconLayoutSidebarLeftExpand
    : IconLayoutSidebarLeftCollapse;

  return (
    <aside
      className={`sticky top-0 hidden h-screen shrink-0 flex-col gap-5 border-r border-border bg-background py-4 lg:flex ${collapsed ? 'w-16 px-2' : 'w-56 px-3.5 xl:w-60'}`}
    >
      <div
        className={`flex items-center ${collapsed ? 'flex-col gap-3' : 'justify-between px-1.5'}`}
      >
        <BrandMark href="/app" compact={collapsed} />
        <button
          type="button"
          onClick={toggle}
          aria-label={toggleLabel}
          title={toggleLabel}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <ToggleIcon size={18} stroke={1.8} />
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
        <NavLink
          to="/app"
          end
          title={tip(t('dashboard'))}
          aria-label={t('dashboard')}
          className={itemClass}
        >
          <IconHome2 size={17} stroke={1.8} />
          {text(t('dashboard'))}
        </NavLink>
        <NavLink
          to="/app/pages"
          title={tip(t('pages'))}
          aria-label={t('pages')}
          className={itemClass}
        >
          <IconAddressBook size={17} stroke={1.8} />
          {text(t('pages'))}
        </NavLink>
        <NavLink
          to="/app/forms"
          title={tip(t('forms'))}
          aria-label={t('forms')}
          className={itemClass}
        >
          <IconForms size={17} stroke={1.8} />
          {text(t('forms'))}
        </NavLink>
        <NavLink
          to="/app/agenda"
          title={tip(t('agenda'))}
          aria-label={t('agenda')}
          className={itemClass}
        >
          <IconCalendarEvent size={17} stroke={1.8} />
          {text(t('agenda'))}
        </NavLink>
        <AdminGuard>
          <NavLink
            to="/admin"
            title={tip(t('admin'))}
            aria-label={t('admin')}
            className={itemClass}
          >
            <IconSettings size={17} stroke={1.8} />
            {text(t('admin'))}
          </NavLink>
        </AdminGuard>
      </nav>

      <div className="flex flex-col gap-0.5 border-t border-border pt-3">
        <NotificationBell withLabel collapsed={collapsed} />
        <button
          type="button"
          onClick={() => setColorScheme(isDark ? 'light' : 'dark')}
          title={tip(themeLabel)}
          aria-label={themeLabel}
          className={`${rowClass(collapsed)} text-muted-foreground hover:bg-accent hover:text-accent-foreground`}
        >
          <ThemeIcon size={17} stroke={1.8} />
          {text(themeLabel)}
        </button>
        {user && (
          <NavLink
            to="/app/account"
            title={collapsed ? t('my_account') : user.email}
            aria-label={t('my_account')}
            className={itemClass}
          >
            <IconUser size={17} stroke={1.8} />
            {text(t('my_account'))}
          </NavLink>
        )}
        <button
          type="button"
          onClick={handleLogout}
          title={tip(t('logout'))}
          aria-label={t('logout')}
          className={`${rowClass(collapsed)} font-semibold text-destructive hover:bg-destructive/10`}
        >
          <IconLogout size={17} stroke={1.8} />
          {text(t('logout'))}
        </button>
      </div>
    </aside>
  );
}
