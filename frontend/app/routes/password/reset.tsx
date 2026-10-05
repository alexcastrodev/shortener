import { goAfterLogin } from '../../modules/oauth/return-to';
import { Button, PinInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('auth');
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
        message: t('password_updated'),
      });
      goAfterLogin(navigate);
    },
    onError: error => {
      const [message, title] = explainAuthError(error as AuthError);
      notifyError(message, title);
    },
  });

  return (
    <AuthShell
      title={t('reset_title')}
      subtitle={
        <>
          {t('reset_sent_prefix')}{' '}
          <span className="font-medium text-foreground">{email}</span>{' '}
          {t('reset_sent_suffix')}
        </>
      }
      footer={
        <Link
          to="/password/forgot"
          state={{ email }}
          className="hover:underline"
        >
          {t('resend')}
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
          <p className="mb-2 text-sm font-medium">{t('code_label')}</p>
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
          label={t('new_password_label')}
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
          {t('save_and_login')}
        </Button>
      </form>
    </AuthShell>
  );
}
