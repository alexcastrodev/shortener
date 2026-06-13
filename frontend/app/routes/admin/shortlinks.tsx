import { Badge, Center, Group, Loader, Switch } from '@mantine/core';
import { IconLink, IconLock } from '@tabler/icons-react';
import { Alert, Card, PageContainer } from '@internal/ui';
import { useGetLoggedUser } from '@internal/core/actions/get-logged-user/get-logged-user.hook';
import {
  useAdminGetShortlinks,
  adminGetShortlinksKey,
} from '@internal/core/actions/admin-shortlink/admin-shortlink.hook';
import { useToggleShortlinkSafe } from '@internal/core/actions/admin-shortlink-toggle-safe/admin-shortlink-toggle-safe.hook';
import { useToggleShortlinkActive } from '@internal/core/actions/admin-shortlink-toggle-active/admin-shortlink-toggle-active.hook';
import { useQueryClient } from '@tanstack/react-query';
import type { Shortlink } from '@internal/core/types/Shortlink';
import type { AdminGetShortlinksResponse } from '@internal/core/actions/admin-shortlink/admin-shortlink.types';

export const ssr = false;

export function meta() {
  return [
    { title: 'Shortlinks - Administration' },
    { name: 'description', content: 'Manage shortlinks' },
  ];
}

export default function AdminShortlinksPage() {
  const { data } = useGetLoggedUser();
  const queryClient = useQueryClient();
  const { data: shortlinksData, isLoading, error } = useAdminGetShortlinks();
  const shortlinks = shortlinksData?.shortlink || [];

  const patchShortlink = (updated: Shortlink) => {
    queryClient.setQueryData<AdminGetShortlinksResponse>(
      adminGetShortlinksKey,
      prev => {
        if (!prev) return prev;
        return {
          ...prev,
          shortlink: prev.shortlink.map(s =>
            s.id === updated.id ? updated : s
          ),
        };
      }
    );
  };

  const toggleSafeMutation = useToggleShortlinkSafe({
    onSuccess: response => patchShortlink(response.shortlink),
  });

  const toggleActiveMutation = useToggleShortlinkActive({
    onSuccess: response => patchShortlink(response.shortlink),
  });

  if (data && !data.user?.admin) {
    return (
      <PageContainer>
        <Alert
          variant="error"
          icon={<IconLock size={24} />}
          title="Access denied"
        >
          You do not have permission to access this page.
        </Alert>
      </PageContainer>
    );
  }

  if (isLoading) {
    return (
      <PageContainer>
        <Center py="xl">
          <Loader size="lg" color="brand" />
        </Center>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <Alert variant="error" icon={<IconLock size={24} />} title="Error">
          Failed to load shortlinks. Please try again later.
        </Alert>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="pb-24 sm:pb-10">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="inline-flex size-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
            <IconLink size={21} stroke={1.8} />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Administration
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">
              Shortlinks
            </h1>
          </div>
        </div>
      </div>

      {shortlinks.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="font-semibold text-foreground">No shortlinks found</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Shortlinks will appear here when they exist in the system.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {shortlinks.map(shortlink => (
            <Card key={shortlink.id} className="p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="max-w-full truncate text-base font-semibold text-foreground">
                      {shortlink.title || 'Untitled'}
                    </h2>
                    <Badge
                      size="sm"
                      variant="light"
                      color={shortlink.created_by_guest ? 'yellow' : 'brand'}
                    >
                      {shortlink.created_by_guest ? 'Guest' : 'Authenticated'}
                    </Badge>
                  </div>
                  <p className="mt-2 break-all text-sm text-muted-foreground">
                    {shortlink.original_url}
                  </p>
                  <p className="mt-2 text-sm font-medium text-primary">
                    {shortlink.short_code}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:min-w-64">
                  <div className="rounded-md border border-border bg-muted p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Events
                    </p>
                    <p className="mt-1 text-xl font-semibold text-foreground">
                      {shortlink.events_count}
                    </p>
                  </div>
                  <div className="rounded-md border border-border bg-muted p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      User
                    </p>
                    <p className="mt-1 truncate text-sm font-semibold text-foreground">
                      {shortlink.user?.email || 'Guest'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
                <Group justify="space-between" wrap="nowrap">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Safe
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Google Safe Browsing state
                    </p>
                  </div>
                  <Switch
                    checked={Boolean(shortlink.safe)}
                    onChange={() => toggleSafeMutation.mutate(shortlink.id)}
                    size="sm"
                    aria-label={`toggle-safe-${shortlink.id}`}
                  />
                </Group>

                <Group justify="space-between" wrap="nowrap">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Active
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Redirect availability
                    </p>
                  </div>
                  <Switch
                    checked={shortlink.inactive_at == null}
                    onChange={() => toggleActiveMutation.mutate(shortlink.id)}
                    size="sm"
                    aria-label={`toggle-active-${shortlink.id}`}
                  />
                </Group>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
