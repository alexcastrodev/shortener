import { useNavigate } from 'react-router';
import { useLoginGoogle } from '@internal/core/actions/login-google/login-google.hook';
import { useUserState } from '@internal/core/states/use-user-state';
import { notifyError } from '@internal/core/utils/notify';
import { explainAuthError, type AuthError } from './auth-errors';

// Exchanges Google's ID token for a Kurz session, then goes to the app.
export function useGoogleSignIn() {
  const navigate = useNavigate();
  const { setUser } = useUserState();

  const mutation = useLoginGoogle({
    onSuccess: ({ user }) => {
      setUser(user);
      navigate('/app');
    },
    onError: error => {
      const authError = error as AuthError;
      if (authError?.response?.status === 403) {
        notifyError(
          'Your account has been deactivated.',
          'Account deactivated'
        );
        return;
      }
      const [message, title] = explainAuthError(authError);
      notifyError(message, title);
    },
  });

  return {
    signIn: (code: string) => mutation.mutate({ code }),
    pending: mutation.isPending,
  };
}
