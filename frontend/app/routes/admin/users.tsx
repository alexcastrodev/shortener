import { Breadcrumb } from '../../components/breadcrumb';
import { Badge, Button, Center, Loader, SegmentedControl, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconLock, IconSearch, IconUsers } from '@tabler/icons-react';
import { Alert, Card, PageContainer } from '@internal/ui';
import { useGetLoggedUser } from '@internal/core/actions/get-logged-user/get-logged-user.hook';
import {
  useGetManageUsers,
  getManageUsersKey,
} from '@internal/core/actions/get-manage-users/get-manage-users.hook';
import type { GetManageUsersParams } from '@internal/core/actions/get-manage-users/get-manage-users.types';
import { useToggleUserActive } from '@internal/core/actions/admin-user-toggle-active/admin-user-toggle-active.hook';
import { useQueryClient } from '@tanstack/react-query';
import { notifyError } from '@internal/core/utils/notify';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const ssr = false;

export function meta() {
  return [
    { title: 'Users - Administration' },
    { name: 'description', content: 'Manage users' },
  ];
}

type StatusFilter = 'active' | 'inactive' | 'all';

export default function UsersPage() {
  const { data } = useGetLoggedUser();
  const queryClient = useQueryClient();
  const { t } = useTranslation('admin');

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 300);

  const queryParams = useMemo<GetManageUsersParams>(() => {
    const p: GetManageUsersParams = {};
    if (statusFilter !== 'all') p.status = statusFilter;
    if (debouncedSearch.trim()) p.q = debouncedSearch.trim();
    return p;
  }, [statusFilter, debouncedSearch]);

  const { data: usersData, isLoading, error } = useGetManageUsers(queryParams);
  const users = usersData?.user || [];
  const total = usersData?.meta?.total ?? users.length;

  const { mutate: toggleActive, isPending } = useToggleUserActive({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['get-manage-users'] });
    },
    onError: () => {
      notifyError(t('failed_update_user'));
    },
  });

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
          {t('failed_load_users')}
        </Alert>
      </PageContainer>
    );
  }

  const currentUserId = data?.user?.id;

  return (
    <PageContainer className="pb-24 sm:pb-10">
      <Breadcrumb items={[
        { label: t('administration'), href: '/admin' },
        { label: t('users') },
      ]} />
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="inline-flex size-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
            <IconUsers size={21} stroke={1.8} />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {t('administration')}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">{t('users')}</h1>
          </div>
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <TextInput
          placeholder={t('search_by_email')}
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
            ? `${users.length} users`
            : `${users.length} of ${total} users`}
        </p>
      </div>

      {isLoading ? (
        <Center py="xl">
          <Loader size="lg" color="brand" />
        </Center>
      ) : users.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="font-semibold text-foreground">{t('no_users_found')}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {total > 0
              ? t('adjust_filters')
              : t('users_empty')}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {users.map(user => {
            const isDeactivated = !!user.deactivated_at;
            const isSelf = String(user.id) === String(currentUserId);

            return (
              <Card key={user.id} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-foreground">
                      {user.email}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Joined {new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <Badge
                      color={user.admin ? 'brand' : 'gray'}
                      variant="light"
                    >
                      {user.admin ? t('admin') : t('user')}
                    </Badge>
                    {isDeactivated && (
                      <Badge color="red" variant="light">
                        {t('deactivated')}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{user.shortlinks_count} shortlinks</span>
                </div>

                {!isSelf && (
                  <div className="mt-4">
                    <Button
                      fullWidth
                      variant="subtle"
                      color={isDeactivated ? 'green' : 'red'}
                      size="sm"
                      loading={isPending}
                      onClick={() => toggleActive(user.id)}
                    >
                      {isDeactivated ? t('reactivate') : t('deactivate')}
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
