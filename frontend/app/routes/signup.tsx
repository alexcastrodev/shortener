import { Button, TextInput } from '@mantine/core';
import { useRef, useState } from 'react';
import type { MetaFunction } from 'react-router';
import { Link, useNavigate } from 'react-router';
import { useSignup } from '@internal/core/actions/signup/signup.hook';
import { notifyError } from '@internal/core/utils/notify';
import { useSubmitLock } from '../modules/auth/use-submit-lock';
import { AuthDivider, AuthShell } from '../modules/auth/auth-shell';
import { GOOGLE_CLIENT_ID, GoogleButton } from '../modules/auth/google-button';
import { useGoogleSignIn } from '../modules/auth/use-google-sign-in';
import {
  NewPasswordFields,
  useNewPassword,
} from '../modules/auth/new-password-fields';
import { explainAuthError, type AuthError } from '../modules/auth/auth-errors';
import {
  Turnstile,
  TURNSTILE_SITE_KEY,
  type TurnstileHandle,
} from '../modules/auth/turnstile';

export const ssr = false;

export const meta: MetaFunction = () => {
  return [{ title: 'Sign up - Kurz' }];
};

export default function Signup() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const submitOnce = useSubmitLock();
  const google = useGoogleSignIn();
  const newPassword = useNewPassword();
  const password = newPassword.password;
  const turnstile = useRef<TurnstileHandle>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const checking = !!TURNSTILE_SITE_KEY && !turnstileToken;

  const signup = useSignup({
    onSuccess: () =>
      navigate('/login-confirmation', {
        state: { email: email.trim(), purpose: 'sign_up' },
      }),
    onError: error => {
      const [message, title] = explainAuthError(error as AuthError);
      notifyError(message, title);
    },
    onSettled: () => turnstile.current?.reset(),
  });

  return (
    <AuthShell
      title="Create your Kurz account"
      subtitle={
        <>
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-semibold text-primary underline underline-offset-4 hover:text-foreground"
          >
            Log in
          </Link>
          .
        </>
      }
      footer="Free, no credit card. We send a code to confirm your email."
    >
      {GOOGLE_CLIENT_ID && (
        <>
          <GoogleButton onCode={google.signIn} pending={google.pending} />
          <AuthDivider />
        </>
      )}

      <form
        className="space-y-4"
        onSubmit={event => {
          event.preventDefault();
          if (!newPassword.check()) return;
          submitOnce(release =>
            signup.mutate(
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
          autoComplete="email"
          value={email}
          onChange={event => setEmail(event.currentTarget.value)}
          required
        />
        <NewPasswordFields size="md" fields={newPassword.fields} />

        <Turnstile
          ref={turnstile}
          action="signup"
          onToken={setTurnstileToken}
        />

        <Button
          type="submit"
          fullWidth
          size="md"
          color="brand"
          loading={signup.isPending}
          disabled={checking}
        >
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}
