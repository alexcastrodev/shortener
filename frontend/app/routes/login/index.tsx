import {
  Alert,
  Button,
  PasswordInput,
  TextInput,
  Transition,
} from '@mantine/core';
import { IconAlertTriangle, IconMail } from '@tabler/icons-react';
import { useRef, useState } from 'react';
import type { MetaFunction } from 'react-router';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useLoginPassword } from '@internal/core/actions/login-password/login-password.hook';
import { useLoginRequest } from '@internal/core/actions/login-request/login-request.hook';
import { useUserState } from '@internal/core/states/use-user-state';
import { notifyError } from '@internal/core/utils/notify';
import { AuthDivider, AuthShell } from '../../modules/auth/auth-shell';
import { useSubmitLock } from '../../modules/auth/use-submit-lock';
import {
  GOOGLE_CLIENT_ID,
  GoogleButton,
} from '../../modules/auth/google-button';
import { useGoogleSignIn } from '../../modules/auth/use-google-sign-in';
import { ProviderButton } from '../../modules/auth/provider-button';
import {
  explainAuthError,
  type AuthError,
} from '../../modules/auth/auth-errors';
import {
  Turnstile,
  TURNSTILE_SITE_KEY,
  type TurnstileHandle,
} from '../../modules/auth/turnstile';

export const ssr = false;

export const meta: MetaFunction = () => {
  return [{ title: 'Log in - Kurz' }];
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const navigate = useNavigate();
  const { setUser } = useUserState();
  const [searchParams] = useSearchParams();
  const submitOnce = useSubmitLock();
  const deactivated = searchParams.get('deactivated') === 'true';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const turnstile = useRef<TurnstileHandle>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const emailReady = EMAIL.test(email.trim());
  // Turnstile's check is usually invisible and takes under a second.
  const checking = !!TURNSTILE_SITE_KEY && !turnstileToken;

  const onError = (error: AuthError) => {
    const [message, title] = explainAuthError(error);
    notifyError(message, title);
  };
  // A token is single use, whatever the outcome.
  const onSettled = () => turnstile.current?.reset();

  const passwordLogin = useLoginPassword({
    onSuccess: ({ user }) => {
      setUser(user);
      navigate('/app');
    },
    onError: error => {
      setPassword('');
      onError(error as AuthError);
    },
    onSettled,
  });

  const codeRequest = useLoginRequest({
    onSuccess: () =>
      navigate('/login-confirmation', {
        state: { email: email.trim(), purpose: 'sign_in' },
      }),
    onError: error => onError(error as AuthError),
    onSettled,
  });

  const google = useGoogleSignIn();
  const busy =
    passwordLogin.isPending || codeRequest.isPending || google.pending;

  return (
    <AuthShell
      title="Log in to Kurz"
      subtitle={
        <>
          Don&apos;t have an account?{' '}
          <Link
            to="/signup"
            className="font-semibold text-primary underline underline-offset-4 hover:text-foreground"
          >
            Sign up
          </Link>
          .
        </>
      }
    >
      {deactivated && (
        <Alert
          icon={<IconAlertTriangle size={18} />}
          title="Account deactivated"
          color="red"
          className="mb-6"
        >
          Your account has been deactivated. If you believe this is a mistake,
          contact{' '}
          <a
            href="mailto:kurz.fyi@gmail.com"
            className="font-semibold underline"
          >
            kurz.fyi@gmail.com
          </a>
          .
        </Alert>
      )}

      <div className="space-y-3">
        {GOOGLE_CLIENT_ID && (
          <GoogleButton text="signin_with" onCredential={google.signIn} />
        )}
        <ProviderButton to="/signup" icon={IconMail}>
          Sign up with email
        </ProviderButton>
      </div>
      <AuthDivider />

      <form
        className="space-y-4"
        onSubmit={event => {
          event.preventDefault();
          if (!emailReady || !password) return;
          submitOnce(release =>
            passwordLogin.mutate(
              {
                email: email.trim(),
                password,
                turnstile_token: turnstileToken ?? undefined,
              },
              { onSettled: release }
            )
          );
        }}
      >
        <TextInput
          label="Email"
          type="email"
          size="md"
          placeholder="do.you.know@university.kurz.fyi"
          autoComplete="username"
          value={email}
          onChange={event => setEmail(event.currentTarget.value)}
          required
        />

        <Transition mounted={emailReady} transition="fade-down" duration={180}>
          {styles => (
            <div style={styles}>
              <div className="mb-1 flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-medium">
                  Password
                </label>
                <Link
                  to="/password/forgot"
                  state={{ email: email.trim() }}
                  className="text-sm font-semibold text-foreground hover:underline"
                >
                  Forgot your password?
                </Link>
              </div>
              <PasswordInput
                id="password"
                size="md"
                autoComplete="current-password"
                value={password}
                onChange={event => setPassword(event.currentTarget.value)}
              />
            </div>
          )}
        </Transition>

        <Turnstile ref={turnstile} action="login" onToken={setTurnstileToken} />

        <Button
          type="submit"
          fullWidth
          size="md"
          color="brand"
          loading={passwordLogin.isPending}
          disabled={!emailReady || !password || checking || busy}
        >
          {checking && emailReady && password
            ? 'Checking your browser…'
            : 'Log in'}
        </Button>
      </form>

      <Button
        fullWidth
        mt="sm"
        size="sm"
        variant="subtle"
        color="gray"
        leftSection={<IconMail size={16} />}
        loading={codeRequest.isPending}
        disabled={checking || busy}
        onClick={() => {
          if (!emailReady) {
            notifyError('Enter your email first, then we send you a code.');
            return;
          }
          codeRequest.mutate({
            email: email.trim(),
            turnstile_token: turnstileToken ?? undefined,
          });
        }}
      >
        Email me a sign-in code instead
      </Button>
    </AuthShell>
  );
}
