import { Layout } from '@internal/ui';
import { AppHeader } from '../components/app-header';
import { MobileNav } from '../components/mobile-nav';
import { LoadingOverlay } from '@mantine/core';
import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router';
import { useGetLoggedUser } from '@internal/core/actions/get-logged-user/get-logged-user.hook';
import { useUserState } from '@internal/core/states/use-user-state';

export default function LayoutComponent() {
  const navigate = useNavigate();
  const { isLoading, isError, data } = useGetLoggedUser();
  const setUser = useUserState(state => state.setUser);

  // The cookie is the source of truth for the session; keep the cached
  // profile (used by the header) in sync with it.
  useEffect(() => {
    if (data?.user) setUser(data.user);
  }, [data, setUser]);

  useEffect(() => {
    if (isError) navigate('/login');
  }, [isError, navigate]);

  if (isLoading || isError) {
    return (
      <div style={{ position: 'relative', height: '100vh' }}>
        <LoadingOverlay visible />
      </div>
    );
  }

  if (!data) return null;

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
