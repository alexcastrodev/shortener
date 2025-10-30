import { Button, Menu, Group } from '@mantine/core';
import { NavLink, useLocation, useNavigate } from 'react-router';
import {
  IconHome2,
  IconLogout,
  IconChevronDown,
  IconUsers,
  IconLink,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { useUserState } from '@internal/core/states/use-user-state';
import { AdminGuard } from '../admin-guard';

interface HeaderState {
  title?: string;
  subtitle?: string;
  showTitle?: boolean;
}

export function AppHeader() {
  const navigate = useNavigate();
  const { t } = useTranslation('menu');
  const { clear } = useUserState();
  const { pathname } = useLocation();

  const handleLogout = () => {
    clear();
    navigate('/login');
  };

  const titles: Record<string, HeaderState> = {
    '/app': {
      title: t('dashboard'),
      subtitle: t('home_subtitle'),
      showTitle: true,
    },
    '/admin/users': {
      title: t('users'),
      subtitle: t('manage_users'),
      showTitle: true,
    },
    '/admin/shortlinks': {
      title: t('shortlinks'),
      subtitle: t('manage_shortlinks'),
      showTitle: true,
    },
  };

  return (
    <nav className="sticky top-0 z-50 px-4 sm:px-6 py-4 sm:py-5 border-b border-zinc-800 bg-black/50 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-6">
          <a href="/app" className="flex items-center gap-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-violet-600 rounded-lg flex items-center justify-center">
              <IconLink size={18} className="sm:hidden" stroke={2.5} />
              <IconLink size={20} className="hidden sm:block" stroke={2.5} />
            </div>
            <span className="text-lg sm:text-xl font-semibold text-white">
              Kurz
            </span>
          </a>

          <Group gap="sm" visibleFrom="sm" className="ml-4">
            <Button
              component={NavLink}
              to="/app"
              variant="subtle"
              leftSection={<IconHome2 size={18} stroke={1.5} />}
              styles={{
                root: {
                  color: '#a1a1aa',
                  '&:hover': {
                    backgroundColor: 'rgba(63, 63, 70, 0.5)',
                    color: '#ffffff',
                  },
                  '&[data-active]': {
                    color: '#a78bfa',
                    backgroundColor: 'rgba(124, 58, 237, 0.1)',
                  },
                },
              }}
            >
              {t('dashboard')}
            </Button>

            <AdminGuard>
              <Menu shadow="md" width={200}>
                <Menu.Target>
                  <Button
                    variant="subtle"
                    rightSection={<IconChevronDown size={18} stroke={1.5} />}
                    styles={{
                      root: {
                        color: '#a1a1aa',
                        '&:hover': {
                          backgroundColor: 'rgba(63, 63, 70, 0.5)',
                          color: '#ffffff',
                        },
                      },
                    }}
                  >
                    {t('administration')}
                  </Button>
                </Menu.Target>

                <Menu.Dropdown
                  style={{
                    backgroundColor: '#27272a',
                    borderColor: '#3f3f46',
                  }}
                >
                  <Menu.Item
                    component={NavLink}
                    to="/admin/users"
                    leftSection={<IconUsers size={16} stroke={1.5} />}
                    style={{ color: '#ffffff' }}
                  >
                    {t('users')}
                  </Menu.Item>
                  <Menu.Item
                    component={NavLink}
                    to="/admin/shortlinks"
                    leftSection={<IconLink size={16} stroke={1.5} />}
                    style={{ color: '#ffffff' }}
                  >
                    {t('shortlinks')}
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </AdminGuard>
          </Group>
        </div>

        <Group gap="md">
          <Button
            variant="subtle"
            onClick={handleLogout}
            leftSection={<IconLogout size={18} stroke={1.5} />}
            styles={{
              root: {
                color: '#fca5a5',
                '&:hover': {
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  color: '#ef4444',
                },
              },
            }}
            visibleFrom="sm"
          >
            {t('logout')}
          </Button>

          <Button
            variant="subtle"
            onClick={handleLogout}
            hiddenFrom="sm"
            styles={{
              root: {
                color: '#fca5a5',
                padding: '0.5rem',
                minWidth: 'auto',
                '&:hover': {
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  color: '#ef4444',
                },
              },
            }}
          >
            <IconLogout size={18} stroke={1.5} />
          </Button>
        </Group>
      </div>
    </nav>
  );
}
