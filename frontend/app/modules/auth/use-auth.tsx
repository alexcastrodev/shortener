import { useNavigate } from 'react-router';
import { useUserState } from '@internal/core/states/use-user-state';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getLoggedUserPublic } from '@internal/core/actions/get-logged-user/get-logged-user.public.service';

export function useAuth() {
  const navigate = useNavigate();
  const { user, clear } = useUserState();
  // Only used here, if it changes, move to a new action folder
  const { error } = useQuery({
    queryKey: ['public', 'user'],
    enabled: !!user,
    queryFn: getLoggedUserPublic,
  });

  useEffect(() => {
    error && clear();
  }, [error]);

  const handleLogout = () => {
    clear();
    localStorage.removeItem('token');
    navigate('/');
  };

  return {
    user,
    isAuthenticated: !!user,
    handleLogout,
  };
}
