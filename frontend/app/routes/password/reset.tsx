import { Button, PinInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useEffect, useState } from 'react';
import type { MetaFunction } from 'react-router';
import { Link, useLocation, useNavigate } from 'react-router';
import { usePasswordReset } from '@internal/core/actions/password-reset/password-reset.hook';
import { useUserState } from '@internal/core/states/use-user-state';
import { notifyError } from '@internal/core/utils/notify';
import { useSubmitLock } from '../../modules/auth/use-submit-lock';
import { AuthShell } from '../../modules/auth/auth-shell';
import {
  NewPasswordFields,
  useNewPassword,
} from '../../modules/auth/new-password-fields';
import {
  explainAuthError,
  type AuthError,
} from '../../modules/auth/auth-errors';

export const ssr = false;

export const meta: MetaFunction = () => {
  return [{ title: 'Choose a new password - Kurz' }];
};

export default function ResetPassword() {
  const navigate = useNavigate();
  const { setUser } = useUserState();
  const location = useLocation();
  const email: string | undefined = location.state?.email;
  const [code, setCode] = useState('');
  const submitOnce = useSubmitLock();
  const newPassword = useNewPassword();
  const password = newPassword.password;

  useEffect(() => {
    if (!email) navigate('/password/forgot', { replace: true });
  }, [email, navigate]);

  const reset = usePasswordReset({
    onSuccess: ({ user }) => {
      setUser(user);
      notifications.show({
        color: 'green',
        message: 'Password updated. Other sessions were signed out.',
      });
      navigate('/app');
    },
    onError: error => {
      const [message, title] = explainAuthError(error as AuthError);
      notifyError(message, title);
    },
  });

  return (
    <AuthShell
      title="Choose a new password"
      subtitle={
        <>
          If <span className="font-medium text-foreground">{email}</span> has an
          account, a code is on its way.
        </>
      }
      footer={
        <Link
          to="/password/forgot"
          state={{ email }}
          className="hover:underline"
        >
          Didn&apos;t get it? Send again
        </Link>
      }
    >
      <form
        className="space-y-5"
        onSubmit={event => {
          event.preventDefault();
          if (!email || !newPassword.check()) return;
          submitOnce(release =>
            reset.mutate({ email, code, password }, { onSettled: release })
          );
        }}
      >
        <div>
          <p className="mb-2 text-sm font-medium">Code</p>
          <PinInput
            length={7}
            type="number"
            inputMode="numeric"
            oneTimeCode
            placeholder=""
            size="md"
            gap={6}
            value={code}
            onChange={setCode}
          />
        </div>
        <NewPasswordFields
          label="New password"
          size="md"
          fields={newPassword.fields}
        />
        <Button
          type="submit"
          fullWidth
          size="md"
          color="brand"
          loading={reset.isPending}
          disabled={code.length !== 7}
        >
          Save and log in
        </Button>
      </form>
    </AuthShell>
  );
}
