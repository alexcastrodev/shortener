import { useUserState } from '@internal/core/states/use-user-state';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getLoggedUserPublic } from '@internal/core/actions/get-logged-user/get-logged-user.public.service';
import { useLogout } from './use-logout';

export function useAuth() {
  const { user, clear } = useUserState();
  const handleLogout = useLogout('/');

  const { error } = useQuery({
    queryKey: ['public', 'user'],
    enabled: !!user,
    queryFn: getLoggedUserPublic,
  });

  useEffect(() => {
    if (error) clear();
  }, [error, clear]);

  return {
    user,
    isAuthenticated: !!user,
    handleLogout,
  };
}
