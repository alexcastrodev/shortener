import { Layout } from '@internal/ui';
import { AppHeader } from '../components/app-header';
import { MobileNav } from '../components/mobile-nav';
import { LoadingOverlay } from '@mantine/core';
import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router';
import { useGetLoggedUser } from '@internal/core/actions/get-logged-user/get-logged-user.hook';
import { Providers } from './providers';

function LayoutContent() {
  const navigate = useNavigate();
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
    <div
      style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}
    >
      <AppHeader />
      <Layout.Main>
        <div className="pb-20 sm:pb-0">
          <Outlet />
        </div>
      </Layout.Main>
      <MobileNav />
    </div>
  );
}

export default function LayoutComponent() {
  return (
    <Providers>
      <LayoutContent />
    </Providers>
  );
}
