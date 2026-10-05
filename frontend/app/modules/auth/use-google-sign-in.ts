import { goAfterLogin } from '../oauth/return-to';
import { useNavigate } from 'react-router';
import { useLoginGoogle } from '@internal/core/actions/login-google/login-google.hook';
import { useUserState } from '@internal/core/states/use-user-state';
import { announceRestore } from './deletion-notice';
import { notifyError } from '@internal/core/utils/notify';
import { explainAuthError, type AuthError } from './auth-errors';
import i18n from '../../i18n';

// Exchanges Google's ID token for a Kurz session, then goes to the app.
export function useGoogleSignIn() {
  const navigate = useNavigate();
  const { setUser } = useUserState();

  const mutation = useLoginGoogle({
    onSuccess: response => {
      setUser(response.user);
      announceRestore(response);
      goAfterLogin(navigate);
    },
    onError: error => {
      const authError = error as AuthError;
      if (authError?.response?.status === 403) {
        notifyError(
          i18n.t('auth:deactivated_short'),
          i18n.t('auth:deactivated_title')
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
