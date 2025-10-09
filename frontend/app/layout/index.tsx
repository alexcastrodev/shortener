import { Layout } from '../components/layout';
import { Button, Image, LoadingOverlay } from '@mantine/core';
import { useEffect } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { IconHome2, IconLink, IconLogout } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import LogoDark from '/logo-dark.webp';
import { useUserState } from '@internal/core/states/use-user-state';
import { useGetLoggedUser } from '@internal/core/actions/get-logged-user/get-logged-user.hook';
import { Providers } from './providers';

function LayoutContent() {
  const navigate = useNavigate();
  const { t } = useTranslation('menu');
  const router = useLocation();
  const { clear } = useUserState();
  const { isLoading, isError, data } = useGetLoggedUser();

  useEffect(() => {
    if (isError) navigate('/login');
  }, [isError]);

  if (isLoading || isError) {
    return (
      <div style={{ position: 'relative', height: '100vh' }}>
        <LoadingOverlay visible />
      </div>
    );
  }

  if (!data) null;

  return (
    <Layout>
      <Layout.Nav>
        <Layout.NavHeader>
          <Image mb="md" src={LogoDark} w={80} />
        </Layout.NavHeader>
        <Layout.NavList>
          <Layout.NavItem
            component={NavLink}
            to="/app"
            label={t('dashboard')}
            leftSection={<IconHome2 size={16} stroke={1.5} />}
            active={router.pathname === '/app'}
          />
          <Layout.NavItem
            component={NavLink}
            to="/app/links"
            label={t('links')}
            leftSection={<IconLink size={16} stroke={1.5} />}
            active={router.pathname === '/app/links'}
            variant="subtle"
          />
        </Layout.NavList>
        <Layout.NavFooter>
          <Button
            variant="subtle"
            onClick={() => {
              clear();
              navigate('/login');
            }}
            color="red"
            leftSection={<IconLogout size={16} stroke={1.5} />}
            fullWidth
          >
            {t('logout')}
          </Button>
        </Layout.NavFooter>
      </Layout.Nav>
      <Outlet />
    </Layout>
  );
}

export default function LayoutComponent() {
  return (
    <Providers>
      <LayoutContent />
    </Providers>
  );
}
