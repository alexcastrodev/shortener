import { Badge, Button, Center, Loader, SegmentedControl } from '@mantine/core';
import { IconLock } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Card, PageContainer } from '@internal/ui';
import { useGetLoggedUser } from '@internal/core/actions/get-logged-user/get-logged-user.hook';
import {
  adminAbuseSignalsKey,
  useAdminAbuseSignals,
} from '@internal/core/actions/admin-abuse-signals/admin-abuse-signals.hook';
import type { AbuseSignalStatus } from '@internal/core/actions/admin-abuse-signals/admin-abuse-signals.types';
import { useDismissAbuseSignal } from '@internal/core/actions/admin-dismiss-abuse-signal/admin-dismiss-abuse-signal.hook';
import { useToggleUserActive } from '@internal/core/actions/admin-user-toggle-active/admin-user-toggle-active.hook';
import { notifyError } from '@internal/core/utils/notify';
import { ModerationHeader } from './moderation-header';

export const ssr = false;

export function meta() {
  return [{ title: 'Abuse signals - Moderation' }];
}

const KIND_LABELS = {
  same_text: 'Same title and bio',
  same_links: 'Same set of links',
};

function formatDate(value: string) {
  return new Date(value).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ModerationAbusePage() {
  const { data } = useGetLoggedUser();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AbuseSignalStatus>('open');
  const { data: result, isLoading, error } = useAdminAbuseSignals(status);
  const signals = result?.abuse_signal ?? [];
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: adminAbuseSignalsKey() });

  const dismiss = useDismissAbuseSignal({
    onSuccess: refresh,
    onError: () => notifyError('Could not dismiss the signal.'),
  });
  const toggleUser = useToggleUserActive({
    onSuccess: () => {
      refresh();
      queryClient.invalidateQueries({ queryKey: ['get-manage-users'] });
    },
    onError: () => notifyError('Could not update the user.'),
  });

  if ((data && !data.user?.admin) || error) {
    return (
      <PageContainer>
        <Alert
          variant="error"
          icon={<IconLock size={24} />}
          title="Access denied"
        >
          Only administrators can see abuse signals.
        </Alert>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="pb-24 sm:pb-10">
      <ModerationHeader section="Abuse signals" />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <SegmentedControl
          value={status}
          onChange={value => setStatus(value as AbuseSignalStatus)}
          data={[
            { label: 'Open', value: 'open' },
            { label: 'Dismissed', value: 'dismissed' },
          ]}
        />
        <p className="text-sm text-muted-foreground sm:ml-auto">
          Three or more new accounts publishing the same page within a day.
          Checked hourly.
        </p>
      </div>

      {isLoading ? (
        <Center py="xl">
          <Loader size="lg" color="brand" />
        </Center>
      ) : signals.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="font-semibold text-foreground">No signals</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Nothing suspicious right now.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {signals.map(signal => (
            <Card key={signal.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">
                    {KIND_LABELS[signal.kind]}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {signal.users.length} accounts · first seen{' '}
                    {formatDate(signal.first_seen_at)} · last{' '}
                    {formatDate(signal.last_seen_at)}
                  </p>
                </div>
                <Badge
                  className="shrink-0"
                  color={signal.status === 'open' ? 'orange' : 'gray'}
                  variant="light"
                >
                  {signal.status}
                </Badge>
              </div>

              <p className="mt-4 mb-2 text-xs font-medium text-muted-foreground">
                Pages
              </p>
              <ul className="space-y-1 text-sm">
                {signal.pages.map(page => (
                  <li key={page.id} className="flex min-w-0 items-center gap-2">
                    <a
                      href={`/u/${page.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-foreground underline-offset-2 hover:underline"
                    >
                      {page.display_title || page.slug} · @{page.slug}
                    </a>
                    {page.deleted && (
                      <Badge size="xs" color="gray" variant="light">
                        deleted
                      </Badge>
                    )}
                    {!page.published && !page.deleted && (
                      <Badge size="xs" color="gray" variant="light">
                        unpublished
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>

              <p className="mt-4 mb-2 text-xs font-medium text-muted-foreground">
                Owners
              </p>
              <ul className="space-y-2 text-sm">
                {signal.users.map(user => (
                  <li
                    key={user.id}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="min-w-0 truncate">{user.email}</span>
                    <Button
                      size="compact-xs"
                      variant="subtle"
                      color={user.active ? 'red' : 'green'}
                      loading={
                        toggleUser.isPending && toggleUser.variables === user.id
                      }
                      onClick={() => toggleUser.mutate(user.id)}
                    >
                      {user.active ? 'Deactivate' : 'Reactivate'}
                    </Button>
                  </li>
                ))}
              </ul>

              {signal.status === 'open' && (
                <Button
                  className="mt-4"
                  fullWidth
                  variant="default"
                  size="sm"
                  loading={dismiss.isPending && dismiss.variables === signal.id}
                  onClick={() => dismiss.mutate(signal.id)}
                >
                  Dismiss
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
