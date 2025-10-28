import { useNavigate } from 'react-router';
import { useUserState } from '@internal/core/states/use-user-state';

export function useAuth() {
  const navigate = useNavigate();
  const { user, clear } = useUserState();

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
