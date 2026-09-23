import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { logout } from '@internal/core/actions/logout/logout.service';
import { useUserState } from '@internal/core/states/use-user-state';

export function useLogout(redirectTo = '/login') {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { clear } = useUserState();

  return async () => {
    await logout();
    clear();
    queryClient.clear();
    navigate(redirectTo);
  };
}
