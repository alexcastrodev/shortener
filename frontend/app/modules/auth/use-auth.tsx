import { useNavigate } from 'react-router';
import { useUserState } from '@internal/core/states/use-user-state';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getLoggedUserPublic } from '@internal/core/actions/get-logged-user/get-logged-user.public.service';

export function useAuth() {
  const navigate = useNavigate();
  const { user, clear } = useUserState();

  const { error } = useQuery({
    queryKey: ['public', 'user'],
    enabled: !!user,
    queryFn: getLoggedUserPublic,
  });

  useEffect(() => {
    if (error) clear();
  }, [error, clear]);

  const handleLogout = () => {
    clear();
    navigate('/');
  };

  return {
    user,
    isAuthenticated: !!user,
    handleLogout,
  };
}
