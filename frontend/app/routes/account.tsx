import { Badge, Button, Center, Loader, PasswordInput, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconDownload,
  IconKey,
  IconLogout,
  IconSettings,
  IconTrash,
  IconUserCircle,
} from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Card, PageContainer } from '@internal/ui';
import {
  getLoggedUserKey,
  useGetLoggedUser,
} from '@internal/core/actions/get-logged-user/get-logged-user.hook';
import { getOauthGrantsKey, useGetOauthGrants } from '@internal/core/actions/get-oauth-grants/get-oauth-grants.hook';
import { useRevokeOauthGrant } from '@internal/core/actions/revoke-oauth-grant/revoke-oauth-grant.hook';
import { SCOPE_LABELS } from '../modules/oauth/scopes';
import { modals } from '@mantine/modals';
import { useUpdatePassword } from '@internal/core/actions/update-password/update-password.hook';
import { useDeleteAccount } from '@internal/core/actions/delete-account/delete-account.hook';
import { exportAccountData } from '@internal/core/actions/export-account-data/export-account-data.service';
import { useUserState } from '@internal/core/states/use-user-state';
import { notifyError } from '@internal/core/utils/notify';
import { explainAuthError, type AuthError } from '../modules/auth/auth-errors';
import { rememberScheduledDeletion } from '../modules/auth/deletion-notice';
import { useLogout } from '../modules/auth/use-logout';
import { LanguageCard } from '../i18n/language-switcher';
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

function DownloadData({ hasPassword }: { hasPassword: boolean }) {
  const logout = useLogout();
  const [current, setCurrent] = useState('');
  const [busy, setBusy] = useState(false);
  const [needsSignIn, setNeedsSignIn] = useState(false);

  const download = async () => {
    setBusy(true);
    try {
      const blob = await exportAccountData(hasPassword ? current : undefined);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `kurz-data-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(link.href);
      setCurrent('');
    } catch (failure) {
      const status = (failure as { response?: { status?: number } })?.response?.status;
      if (status === 403) setNeedsSignIn(true);
      else if (status === 422) notifyError('That password is not correct.', 'Data not downloaded');
      else if (status === 413) notifyError('There is too much data for one file. Export your biggest forms to Excel first.', 'Too much data');
      else if (status === 429) notifyError('Too many downloads. Please try again in an hour.', 'Slow down');
      else notifyError('We could not prepare your data. Please try again.', 'Download failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <IconDownload size={18} stroke={1.8} />
        </span>
        <div className="min-w-0">
          <h2 className="font-semibold text-foreground">Download your data</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A JSON file with your account, short links, bio pages, forms and their responses, connected apps and
            saved palettes. It leaves out passwords, tokens and your visitors’ IP addresses.
          </p>
        </div>
      </div>

      {needsSignIn ? (
        <div className="mt-5 rounded-lg border border-border bg-muted/40 p-4 text-sm">
          <p className="text-foreground">For your security, sign in again with an email code, then download your data here.</p>
          <Button className="mt-3" variant="default" size="sm" leftSection={<IconLogout size={15} />} onClick={logout}>
            Sign in again
          </Button>
        </div>
      ) : (
        <form
          className="mt-5 max-w-md space-y-4"
          onSubmit={event => {
            event.preventDefault();
            void download();
          }}
        >
          {hasPassword && (
            <PasswordInput
              label="Password"
              autoComplete="current-password"
              value={current}
              onChange={event => setCurrent(event.currentTarget.value)}
            />
          )}
          <Button type="submit" variant="default" loading={busy} disabled={hasPassword && !current} leftSection={<IconDownload size={16} />}>
            Download my data
          </Button>
        </form>
      )}
    </Card>
  );
}

function DeleteAccount({ email, hasPassword }: { email: string; hasPassword: boolean }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { clear } = useUserState();
  const logout = useLogout();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [current, setCurrent] = useState('');
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const submitOnce = useSubmitLock();

  const remove = useDeleteAccount({
    onSuccess: ({ deletion_due_at }) => {
      clear();
      queryClient.clear();
      rememberScheduledDeletion(deletion_due_at);
      navigate('/login');
    },
    onError: error => {
      const authError = error as AuthError;
      const code = authError?.response?.data?.error;
      if (code === 'reauthentication_required') {
        setNeedsSignIn(true);
        return;
      }
      if (code === 'invalid_current_password') {
        notifyError('That password is not correct.', 'Account not deleted');
        return;
      }
      const [message, title] = explainAuthError(authError);
      notifyError(message, title);
    },
  });

  const matches = confirm.trim().toLowerCase() === email.toLowerCase();

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-500">
          <IconTrash size={18} stroke={1.8} />
        </span>
        <div className="min-w-0">
          <h2 className="font-semibold text-foreground">Delete account</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your links, bio pages, forms, responses and uploaded files go offline now and are
            permanently deleted after 30 days. Signing in again before then cancels the deletion.
          </p>
        </div>
      </div>

      {!open && (
        <Button className="mt-5" variant="default" color="red" c="red.5" onClick={() => setOpen(true)}>
          Delete my account
        </Button>
      )}

      {open && needsSignIn && (
        <div className="mt-5 rounded-lg border border-border bg-muted/40 p-4 text-sm">
          <p className="text-foreground">For your security, sign in again with an email code, then delete your account here.</p>
          <Button className="mt-3" variant="default" size="sm" leftSection={<IconLogout size={15} />} onClick={logout}>
            Sign in again
          </Button>
        </div>
      )}

      {open && !needsSignIn && (
        <form
          className="mt-5 max-w-md space-y-4"
          onSubmit={event => {
            event.preventDefault();
            if (!matches) return;
            submitOnce(release =>
              remove.mutate(
                { confirm_email: confirm.trim(), current_password: hasPassword ? current : undefined },
                { onSettled: release }
              )
            );
          }}
        >
          <TextInput
            label={`Type ${email} to confirm`}
            autoComplete="off"
            value={confirm}
            onChange={event => setConfirm(event.currentTarget.value)}
          />
          {hasPassword && (
            <PasswordInput
              label="Password"
              autoComplete="current-password"
              value={current}
              onChange={event => setCurrent(event.currentTarget.value)}
            />
          )}
          <div className="flex gap-2">
            <Button type="submit" color="red" loading={remove.isPending} disabled={!matches || (hasPassword && !current)}>
              Delete my account
            </Button>
            <Button variant="default" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}

function ConnectedApps() {
  const queryClient = useQueryClient();
  const { data: grants } = useGetOauthGrants();
  const { mutate: revoke } = useRevokeOauthGrant({
    onSuccess: () => queryClient.invalidateQueries({ queryKey: getOauthGrantsKey }),
  });
  const mcpUrl = `${import.meta.env.VITE_BASE_URL}/mcp`;

  const confirmRevoke = (id: number, name: string) =>
    modals.openConfirmModal({
      title: 'Disconnect app?',
      centered: true,
      children: <p className="text-sm">{name} will lose access on its next request.</p>,
      labels: { confirm: 'Disconnect', cancel: 'Keep it' },
      confirmProps: { color: 'red' },
      onConfirm: () => revoke(id),
    });

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="font-semibold text-foreground">Connected apps</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        AI apps you allowed to work with your account. Connector URL:{' '}
        <code className="break-all rounded bg-muted px-1.5 py-0.5 text-xs">{mcpUrl}</code>
      </p>
      {grants?.length === 0 && <p className="mt-4 text-sm text-muted-foreground">No apps connected.</p>}
      <ul className="mt-4 space-y-3">
        {grants?.map(grant => (
          <li key={grant.id} className="flex flex-col gap-3 rounded-lg border border-border p-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{grant.client_name}</p>
              <p className="text-xs text-muted-foreground">
                {grant.redirect_host} · connected {new Date(grant.connected_at).toLocaleDateString('en-US')}
                {grant.last_used_at && ` · last used ${new Date(grant.last_used_at).toLocaleDateString('en-US')}`}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {grant.scopes.map(scope => SCOPE_LABELS[scope]?.label ?? scope).join(' · ')}
              </p>
            </div>
            <Button variant="default" size="xs" className="shrink-0 self-start" onClick={() => confirmRevoke(grant.id, grant.client_name)}>
              Disconnect
            </Button>
          </li>
        ))}
      </ul>
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

        {user.admin && (
          <Card className="flex items-center justify-between gap-4 p-5 sm:p-6">
            <div className="min-w-0">
              <p className="font-semibold text-foreground">Administration</p>
              <p className="text-sm text-muted-foreground">
                Users, shortlinks, audit logs and moderation.
              </p>
            </div>
            <Button
              component={Link}
              to="/admin"
              variant="default"
              leftSection={<IconSettings size={16} />}
              className="shrink-0"
            >
              Open admin
            </Button>
          </Card>
        )}

        <LanguageCard />

        <ConnectedApps />

        <PasswordSection hasPassword={!!user.has_password} />

        <DownloadData hasPassword={!!user.has_password} />

        <DeleteAccount email={user.email} hasPassword={!!user.has_password} />
      </div>
    </PageContainer>
  );
}
