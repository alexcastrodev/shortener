import { Badge, Button, Center, Loader, PasswordInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconKey, IconLogout, IconUserCircle } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Card, PageContainer } from '@internal/ui';
import {
  getLoggedUserKey,
  useGetLoggedUser,
} from '@internal/core/actions/get-logged-user/get-logged-user.hook';
import { useUpdatePassword } from '@internal/core/actions/update-password/update-password.hook';
import { useUserState } from '@internal/core/states/use-user-state';
import { notifyError } from '@internal/core/utils/notify';
import { explainAuthError, type AuthError } from '../modules/auth/auth-errors';
import { useLogout } from '../modules/auth/use-logout';
import { useSubmitLock } from '../modules/auth/use-submit-lock';
import {
  NewPasswordFields,
  useNewPassword,
} from '../modules/auth/new-password-fields';

export const ssr = false;

export function meta() {
  return [{ title: 'Account - Kurz' }];
}

function PasswordSection({ hasPassword }: { hasPassword: boolean }) {
  const queryClient = useQueryClient();
  const { setUser } = useUserState();
  const logout = useLogout();
  const [current, setCurrent] = useState('');
  const newPassword = useNewPassword();
  const next = newPassword.password;
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const submitOnce = useSubmitLock();

  const update = useUpdatePassword({
    onSuccess: ({ user }) => {
      setUser(user);
      queryClient.invalidateQueries({ queryKey: getLoggedUserKey });
      setCurrent('');
      newPassword.reset();
      notifications.show({
        color: 'green',
        message: hasPassword
          ? 'Password changed. Other sessions were signed out.'
          : 'Password set. You can now log in with it.',
      });
    },
    onError: error => {
      const authError = error as AuthError;
      if (authError?.response?.data?.error === 'reauthentication_required') {
        setNeedsSignIn(true);
        return;
      }
      const [message, title] = explainAuthError(authError);
      notifyError(message, title);
    },
  });

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <IconKey size={18} stroke={1.8} />
        </span>
        <div className="min-w-0">
          <h2 className="font-semibold text-foreground">
            {hasPassword ? 'Password' : 'Set a password'}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {hasPassword
              ? 'Changing it signs you out everywhere else.'
              : 'You sign in with emailed codes. Add a password to log in without waiting for an email.'}
          </p>
        </div>
      </div>

      {needsSignIn ? (
        <div className="mt-5 rounded-lg border border-border bg-muted/40 p-4 text-sm">
          <p className="text-foreground">
            For your security, sign in again with an email code, then set your
            password here.
          </p>
          <Button
            className="mt-3"
            variant="default"
            size="sm"
            leftSection={<IconLogout size={15} />}
            onClick={logout}
          >
            Sign in again
          </Button>
        </div>
      ) : (
        <form
          className="mt-5 max-w-md space-y-4"
          onSubmit={event => {
            event.preventDefault();
            if (!newPassword.check()) return;
            submitOnce(release =>
              update.mutate(
                {
                  current_password: hasPassword ? current : undefined,
                  password: next,
                },
                { onSettled: release }
              )
            );
          }}
        >
          {hasPassword && (
            <PasswordInput
              label="Current password"
              autoComplete="current-password"
              value={current}
              onChange={event => setCurrent(event.currentTarget.value)}
              required
            />
          )}
          <NewPasswordFields
            label={hasPassword ? 'New password' : 'Password'}
            fields={newPassword.fields}
          />
          <Button
            type="submit"
            color="brand"
            loading={update.isPending}
            disabled={hasPassword && !current}
          >
            {hasPassword ? 'Change password' : 'Set password'}
          </Button>
        </form>
      )}
    </Card>
  );
}

export default function AccountPage() {
  const { data, isLoading } = useGetLoggedUser();
  const logout = useLogout();
  const user = data?.user;

  if (isLoading || !user) {
    return (
      <Center py="xl">
        <Loader size="lg" color="brand" />
      </Center>
    );
  }

  return (
    <PageContainer className="pb-24 sm:pb-10">
      <div className="mb-6 flex items-center gap-3">
        <div className="inline-flex size-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
          <IconUserCircle size={21} stroke={1.8} />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
      </div>

      <div className="max-w-2xl space-y-4">
        <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">
              Signed in as
            </p>
            <p className="mt-1 truncate font-semibold text-foreground">
              {user.email}
            </p>
            <div className="mt-2 flex gap-1.5">
              {user.admin && (
                <Badge variant="light" color="brand">
                  Admin
                </Badge>
              )}
              <Badge variant="light" color="gray">
                {user.has_password
                  ? 'Password + email code'
                  : 'Email code only'}
              </Badge>
            </div>
          </div>
          <Button
            variant="default"
            leftSection={<IconLogout size={16} />}
            onClick={logout}
            className="shrink-0"
          >
            Log out
          </Button>
        </Card>

        <PasswordSection hasPassword={!!user.has_password} />
      </div>
    </PageContainer>
  );
}
