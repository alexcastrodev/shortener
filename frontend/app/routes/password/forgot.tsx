import { Button, TextInput } from '@mantine/core';
import { useRef, useState } from 'react';
import type { MetaFunction } from 'react-router';
import { Link, useLocation, useNavigate } from 'react-router';
import { usePasswordForgot } from '@internal/core/actions/password-forgot/password-forgot.hook';
import { notifyError } from '@internal/core/utils/notify';
import { useSubmitLock } from '../../modules/auth/use-submit-lock';
import { AuthShell } from '../../modules/auth/auth-shell';
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
  return [{ title: 'Reset your password - Kurz' }];
};

export default function ForgotPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState<string>(location.state?.email ?? '');
  const submitOnce = useSubmitLock();
  const turnstile = useRef<TurnstileHandle>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const checking = !!TURNSTILE_SITE_KEY && !turnstileToken;

  const forgot = usePasswordForgot({
    onSuccess: () =>
      navigate('/password/reset', { state: { email: email.trim() } }),
    onError: error => {
      const [message, title] = explainAuthError(error as AuthError);
      notifyError(message, title);
    },
    onSettled: () => turnstile.current?.reset(),
  });

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your email and we send you a code to choose a new password."
      footer={
        <Link to="/login" className="hover:underline">
          Back to log in
        </Link>
      }
    >
      <form
        className="space-y-4"
        onSubmit={event => {
          event.preventDefault();
          submitOnce(release =>
            forgot.mutate(
              {
                email: email.trim(),
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
          autoComplete="email"
          placeholder="do.you.know@university.kurz.fyi"
          value={email}
          onChange={event => setEmail(event.currentTarget.value)}
          required
        />
        <Turnstile
          ref={turnstile}
          action="password_reset"
          onToken={setTurnstileToken}
        />
        <Button
          type="submit"
          fullWidth
          size="md"
          color="brand"
          loading={forgot.isPending}
          disabled={!email || checking}
        >
          Send reset code
        </Button>
      </form>
    </AuthShell>
  );
}
