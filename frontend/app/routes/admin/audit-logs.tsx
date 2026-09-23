import { Breadcrumb } from '../../components/breadcrumb';
import { Badge, Center, Loader, Select } from '@mantine/core';
import { IconHistory, IconLock } from '@tabler/icons-react';
import { Alert, Card, PageContainer } from '@internal/ui';
import { useGetLoggedUser } from '@internal/core/actions/get-logged-user/get-logged-user.hook';
import { useAdminGetAudits } from '@internal/core/actions/admin-audit/admin-audit.hook';
import { useGetManageUsers } from '@internal/core/actions/get-manage-users/get-manage-users.hook';
import type { AdminGetAuditsParams } from '@internal/core/actions/admin-audit/admin-audit.types';
import type { AuditLog } from '@internal/core/actions/admin-audit/admin-audit.types';
import { useMemo, useState } from 'react';

export const ssr = false;

export function meta() {
  return [
    { title: 'Audit Logs - Administration' },
    { name: 'description', content: 'View audit logs' },
  ];
}

function formatChanges(changes: Record<string, unknown>): string[] {
  return Object.entries(changes).map(([key, value]) => {
    if (Array.isArray(value)) {
      return `${key}: ${JSON.stringify(value[0])} → ${JSON.stringify(value[1])}`;
    }
    return `${key}: ${JSON.stringify(value)}`;
  });
}

function actionColor(action: string): string {
  switch (action) {
    case 'create':
      return 'green';
    case 'update':
      return 'blue';
    case 'destroy':
      return 'red';
    default:
      return 'gray';
  }
}

function AuditCard({ audit }: { audit: AuditLog }) {
  const changes = formatChanges(audit.audited_changes);

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge size="sm" variant="light" color={actionColor(audit.action)}>
              {audit.action}
            </Badge>
            <span className="text-sm font-semibold text-foreground">
              {audit.auditable_type}
            </span>
            <span className="text-xs text-muted-foreground">
              #{audit.auditable_id}
            </span>
          </div>

          {changes.length > 0 && (
            <div className="mt-3 rounded-md border border-border bg-muted p-3">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Changes
              </p>
              {changes.map((change, i) => (
                <p
                  key={i}
                  className="break-all font-mono text-xs text-foreground"
                >
                  {change}
                </p>
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0 text-right">
          {audit.user && (
            <p className="text-sm font-medium text-foreground">
              {audit.user.email}
            </p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {new Date(audit.created_at).toLocaleString()}
          </p>
          {audit.remote_address && (
            <p className="mt-1 text-xs text-muted-foreground">
              IP: {audit.remote_address}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function AdminAuditLogsPage() {
  const { data } = useGetLoggedUser();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const { data: usersData } = useGetManageUsers();
  const users = usersData?.user || [];

  const userOptions = useMemo(
    () => users.map(u => ({ value: String(u.id), label: u.email })),
    [users]
  );

  const queryParams = useMemo<AdminGetAuditsParams>(() => {
    const p: AdminGetAuditsParams = {};
    if (selectedUserId) p.user_id = selectedUserId;
    return p;
  }, [selectedUserId]);

  const { data: auditsData, isLoading, error } = useAdminGetAudits(queryParams);
  const audits = auditsData?.audit || [];
  const total = auditsData?.meta?.total ?? audits.length;

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

  if (error) {
    return (
      <PageContainer>
        <Alert variant="error" icon={<IconLock size={24} />} title="Error">
          Failed to load audit logs. Please try again later.
        </Alert>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="pb-24 sm:pb-10">
      <Breadcrumb
        items={[
          { label: 'Administration', href: '/admin' },
          { label: 'Audit Logs' },
        ]}
      />
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="inline-flex size-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
            <IconHistory size={21} stroke={1.8} />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Administration
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">
              Audit Logs
            </h1>
          </div>
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select
          placeholder="Filter by user..."
          data={userOptions}
          value={selectedUserId}
          onChange={setSelectedUserId}
          clearable
          searchable
          className="sm:max-w-xs"
        />
        <p className="text-sm text-muted-foreground sm:ml-auto">
          {audits.length} of {total} logs
        </p>
      </div>

      {isLoading ? (
        <Center py="xl">
          <Loader size="lg" color="brand" />
        </Center>
      ) : audits.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="font-semibold text-foreground">No audit logs found</p>
          <p className="mt-2 text-sm text-muted-foreground">
            {total > 0
              ? 'Try adjusting your filters.'
              : 'Audit logs will appear here when changes are made in the system.'}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {audits.map(audit => (
            <AuditCard key={audit.id} audit={audit} />
          ))}
        </div>
      )}
    </PageContainer>
  );
}
