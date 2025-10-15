import {
  Button,
  Menu,
  Image,
  Container,
  Group,
  Burger,
  Drawer,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { NavLink, useLocation, useNavigate } from 'react-router';
import {
  IconHome2,
  IconLogout,
  IconChevronDown,
  IconUsers,
} from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import LogoDark from '/logo-dark.webp';
import { useUserState } from '@internal/core/states/use-user-state';
import { AdminGuard } from '../admin-guard';
import styles from './app-header.module.css';

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
  };

  return (
    <header className={styles.header}>
      <Container size="xl" className={styles.container}>
        <Group justify="space-between" h="100%">
          <Group gap="lg">
            <Image src={LogoDark} w={60} h={40} fit="contain" />

            <div className={styles.titleSection}>
              <h1 className={styles.title}>{titles[pathname]?.title}</h1>
              <p className={styles.subtitle}>{titles[pathname]?.subtitle}</p>
            </div>
          </Group>

          <Group gap="md" visibleFrom="sm">
            <Button
              component={NavLink}
              to="/app"
              variant="subtle"
              leftSection={<IconHome2 size={18} stroke={1.5} />}
              className={styles.navButton}
            >
              {t('dashboard')}
            </Button>

            <AdminGuard>
              <Menu shadow="md" width={200}>
                <Menu.Target>
                  <Button
                    variant="subtle"
                    rightSection={<IconChevronDown size={18} stroke={1.5} />}
                    className={styles.navButton}
                  >
                    {t('administration')}
                  </Button>
                </Menu.Target>

                <Menu.Dropdown>
                  <Menu.Item
                    component={NavLink}
                    to="/admin/users"
                    leftSection={<IconUsers size={16} stroke={1.5} />}
                  >
                    {t('users')}
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </AdminGuard>

            <Button
              variant="subtle"
              onClick={handleLogout}
              color="red"
              leftSection={<IconLogout size={18} stroke={1.5} />}
            >
              {t('logout')}
            </Button>
          </Group>
        </Group>
      </Container>
    </header>
  );
}
