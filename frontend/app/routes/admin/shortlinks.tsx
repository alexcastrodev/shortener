import { Breadcrumb } from '../../components/breadcrumb';
import { Badge, Center, Group, Loader, SegmentedControl, Switch, TextInput, Tooltip } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconCopy, IconLink, IconLock, IconSearch } from '@tabler/icons-react';
import { Alert, Card, PageContainer } from '@internal/ui';
import { useGetLoggedUser } from '@internal/core/actions/get-logged-user/get-logged-user.hook';
import {
  useAdminGetShortlinks,
  adminGetShortlinksKey,
} from '@internal/core/actions/admin-shortlink/admin-shortlink.hook';
import type { AdminGetShortlinksParams } from '@internal/core/actions/admin-shortlink/admin-shortlink.types';
import { useToggleShortlinkSafe } from '@internal/core/actions/admin-shortlink-toggle-safe/admin-shortlink-toggle-safe.hook';
import { useToggleShortlinkActive } from '@internal/core/actions/admin-shortlink-toggle-active/admin-shortlink-toggle-active.hook';
import { useQueryClient } from '@tanstack/react-query';
import { notifySuccess } from '@internal/core/utils/notify';
import { modals } from '@mantine/modals';
import { useMemo, useState } from 'react';
import type { Shortlink } from '@internal/core/types/Shortlink';
import type { AdminGetShortlinksResponse } from '@internal/core/actions/admin-shortlink/admin-shortlink.types';
import { useTranslation } from 'react-i18next';

export const ssr = false;

export function meta() {
  return [
    { title: 'Shortlinks - Administration' },
    { name: 'description', content: 'Manage shortlinks' },
  ];
}

type StatusFilter = 'active' | 'inactive' | 'all';

export default function AdminShortlinksPage() {
  const { data } = useGetLoggedUser();
  const queryClient = useQueryClient();
  const { t } = useTranslation('admin');

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 300);

  const queryParams = useMemo<AdminGetShortlinksParams>(() => {
    const p: AdminGetShortlinksParams = {};
    if (statusFilter !== 'all') p.status = statusFilter;
    if (debouncedSearch.trim()) p.q = debouncedSearch.trim();
    return p;
  }, [statusFilter, debouncedSearch]);

  const {
    data: shortlinksData,
    isLoading,
    error,
  } = useAdminGetShortlinks(queryParams);
  const shortlinks = shortlinksData?.shortlink || [];
  const total = shortlinksData?.meta?.total ?? shortlinks.length;

  const patchShortlink = (updated: Shortlink) => {
    queryClient.setQueriesData<AdminGetShortlinksResponse>(
      { queryKey: ['admin-get-shortlinks'] },
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

  const getDisplayTitle = (s: Shortlink) => {
    if (s.title) return s.title;
    try { return new URL(s.original_url).hostname; } catch { return 'Untitled'; }
  };

  if (data && !data.user?.admin) {
    return (
      <PageContainer>
        <Alert
          variant="error"
          icon={<IconLock size={24} />}
          title={t('access_denied')}
        >
          {t('access_denied_message')}
        </Alert>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <Alert variant="error" icon={<IconLock size={24} />} title={t('error')}>
          {t('failed_load_shortlinks')}
        </Alert>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="pb-24 sm:pb-10">
      <Breadcrumb items={[
        { label: t('administration'), href: '/admin' },
        { label: t('shortlinks') },
      ]} />
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="inline-flex size-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
            <IconLink size={21} stroke={1.8} />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {t('administration')}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">
              {t('shortlinks')}
            </h1>
          </div>
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <TextInput
          placeholder={t('search_shortlinks')}
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={e => setSearch(e.currentTarget.value)}
          className="sm:max-w-xs"
        />
        <SegmentedControl
          value={statusFilter}
          onChange={v => setStatusFilter(v as StatusFilter)}
          data={[
            { label: t('active'), value: 'active' },
            { label: t('inactive'), value: 'inactive' },
            { label: `All (${total})`, value: 'all' },
          ]}
        />
        <p className="text-sm text-muted-foreground sm:ml-auto">
          {statusFilter === 'all' && !debouncedSearch.trim()
            ? `${shortlinks.length} shortlinks`
            : `${shortlinks.length} of ${total} shortlinks`}
        </p>
      </div>

      {isLoading ? (
        <Center py="xl">
          <Loader size="lg" color="brand" />
        </Center>
      ) : shortlinks.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="font-semibold text-foreground">{t('no_shortlinks_found')}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {total > 0
              ? t('adjust_filters')
              : t('shortlinks_empty')}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {shortlinks.map(shortlink => (
            <Card key={shortlink.id} className="p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="max-w-full truncate text-base font-semibold text-foreground">
                      {getDisplayTitle(shortlink)}
                    </h2>
                    <Badge
                      size="sm"
                      variant="light"
                      color={shortlink.is_active ? 'brand' : 'red'}
                    >
                      {shortlink.is_active ? t('active') : t('inactive')}
                    </Badge>
                  </div>
                  <Tooltip label={shortlink.original_url} multiline maw={400} position="bottom-start">
                    <p className="mt-2 truncate text-sm text-muted-foreground">
                      {shortlink.original_url}
                    </p>
                  </Tooltip>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(shortlink.short_url || shortlink.short_code);
                      notifySuccess(t('short_code_copied'));
                    }}
                    className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    {shortlink.short_code}
                    <IconCopy size={14} />
                  </button>
                </div>

                <div className="flex flex-col gap-1 text-sm sm:items-end">
                  <span className="text-muted-foreground">
                    <span className="font-semibold text-foreground">{shortlink.events_count}</span> events
                  </span>
                  <Tooltip label={shortlink.user?.email} disabled={!shortlink.user?.email}>
                    <span className="truncate text-xs text-muted-foreground max-w-40">
                      {shortlink.user?.email || '—'}
                    </span>
                  </Tooltip>
                  {shortlink.created_at && (
                    <Tooltip label={new Date(shortlink.created_at).toLocaleString()}>
                      <span className="text-xs text-muted-foreground">
                        {t('created_on', {
                          date: new Date(shortlink.created_at).toLocaleDateString('en-US', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          }),
                        })}
                      </span>
                    </Tooltip>
                  )}
                </div>
              </div>

              <div className="mt-3 grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
                <Group justify="space-between" wrap="nowrap">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {t('safe')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t('safe_description')}
                    </p>
                  </div>
                  <Switch
                    checked={Boolean(shortlink.safe)}
                    onChange={() => {
                      const action = shortlink.safe ? t('confirm_mark_unsafe') : t('confirm_mark_safe');
                      modals.openConfirmModal({
                        title: `Confirm ${action}`,
                        children: <p className="text-sm text-muted-foreground">{t('confirm_prompt', { action })}</p>,
                        labels: { confirm: t('confirm_action'), cancel: t('cancel') },
                        confirmProps: { color: shortlink.safe ? 'red' : 'green' },
                        onConfirm: () => toggleSafeMutation.mutate(shortlink.id),
                      });
                    }}
                    size="sm"
                    aria-label={`toggle-safe-${shortlink.id}`}
                  />
                </Group>

                <Group justify="space-between" wrap="nowrap">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {t('active_label')}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t('active_description')}
                    </p>
                  </div>
                  <Switch
                    checked={shortlink.inactive_at == null}
                    onChange={() => {
                      const isActive = shortlink.inactive_at == null;
                      const action = isActive ? t('confirm_deactivate') : t('confirm_reactivate');
                      modals.openConfirmModal({
                        title: `Confirm ${action}`,
                        children: <p className="text-sm text-muted-foreground">{t('confirm_prompt', { action })}</p>,
                        labels: { confirm: t('confirm_action'), cancel: t('cancel') },
                        confirmProps: { color: isActive ? 'red' : 'green' },
                        onConfirm: () => toggleActiveMutation.mutate(shortlink.id),
                      });
                    }}
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
