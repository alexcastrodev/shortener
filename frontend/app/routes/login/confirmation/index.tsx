import { Button, PinInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useEffect, useState } from 'react';
import type { MetaFunction } from 'react-router';
import { Link, useLocation, useNavigate } from 'react-router';
import { useLoginVerifyRequest } from '@internal/core/actions/login-verify/login-verify.hook';
import { useUserState } from '@internal/core/states/use-user-state';
import { AuthShell } from '../../../modules/auth/auth-shell';
import type { AuthError } from '../../../modules/auth/auth-errors';

export const ssr = false;

export const meta: MetaFunction = () => {
  return [{ title: 'Check your email - Kurz' }];
};

const CODE_LENGTH = 7;

export default function LoginConfirmation() {
  const navigate = useNavigate();
  const { setUser } = useUserState();
  const location = useLocation();
  const email: string | undefined = location.state?.email;
  const purpose: 'sign_in' | 'sign_up' =
    location.state?.purpose === 'sign_up' ? 'sign_up' : 'sign_in';
  const [code, setCode] = useState('');

  useEffect(() => {
    if (!email) navigate('/login', { replace: true });
  }, [email, navigate]);

  const verify = useLoginVerifyRequest({
    onSuccess: ({ user }) => {
      setUser(user);
      navigate('/app');
    },
    onError: error => {
      setCode('');
      const status = (error as AuthError)?.response?.status;
      notifications.show({
        color: 'red',
        title:
          status === 403
            ? 'Account deactivated'
            : status === 429
              ? 'Too many attempts'
              : 'Wrong code',
        message:
          status === 403
            ? 'Your account has been deactivated. Contact support if you believe this is a mistake.'
            : status === 429
              ? 'Please wait a few minutes, then request a new code and try again.'
              : 'That code is wrong or expired. After several wrong attempts, request a new one.',
      });
    },
  });

  function submit(value: string) {
    if (!email || value.length !== CODE_LENGTH || verify.isPending) return;
    verify.mutate({ email, code: value, purpose });
  }

  return (
    <AuthShell
      title={purpose === 'sign_up' ? 'Confirm your email' : 'Check your email'}
      subtitle={
        <>
          We sent a {CODE_LENGTH}-digit code to{' '}
          <span className="font-medium text-foreground">{email}</span>.
        </>
      }
      footer={
        <Link
          to={purpose === 'sign_up' ? '/signup' : '/login'}
          className="hover:underline"
        >
          Use a different email
        </Link>
      }
    >
      <form
        className="space-y-5"
        onSubmit={event => {
          event.preventDefault();
          submit(code);
        }}
      >
        <div className="flex justify-center">
          <PinInput
            autoFocus
            length={CODE_LENGTH}
            type="number"
            inputMode="numeric"
            oneTimeCode
            placeholder=""
            size="md"
            gap={6}
            value={code}
            onChange={value => {
              setCode(value);
              if (value.length === CODE_LENGTH) submit(value);
            }}
          />
        </div>

        <Button
          type="submit"
          fullWidth
          size="md"
          color="brand"
          loading={verify.isPending}
          disabled={code.length !== CODE_LENGTH}
        >
          {purpose === 'sign_up'
            ? 'Confirm and create account'
            : 'Verify and log in'}
        </Button>

        {/* Kurz sends from a free email plan, so the code sometimes lands in spam. */}
        <div className="flex gap-3 rounded-lg border border-primary/25 bg-primary/5 p-3.5">
          <span className="mt-0.5 text-lg leading-none" aria-hidden="true">
            📬
          </span>
          <div className="text-sm">
            <p className="font-medium text-foreground">
              No code yet? Take a peek in your spam folder.
            </p>
            <p className="mt-1 text-muted-foreground">
              Kurz is free and has no fancy email service behind it, so our
              emails sometimes get lost on the way. Marking it as &ldquo;Not
              spam&rdquo; helps the next one find you.
            </p>
          </div>
        </div>
      </form>
    </AuthShell>
  );
}
