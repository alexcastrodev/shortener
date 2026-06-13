import { Badge, Center, Loader } from '@mantine/core';
import { IconLock, IconUsers } from '@tabler/icons-react';
import { Alert, Card, PageContainer } from '@internal/ui';
import { useGetLoggedUser } from '@internal/core/actions/get-logged-user/get-logged-user.hook';
import { useGetManageUsers } from '@internal/core/actions/get-manage-users/get-manage-users.hook';

export const ssr = false;

export function meta() {
  return [
    { title: 'Users - Administration' },
    { name: 'description', content: 'Manage users' },
  ];
}

export default function UsersPage() {
  const { data } = useGetLoggedUser();
  const { data: usersData, isLoading, error } = useGetManageUsers();
  const users = usersData?.user || [];

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
          Failed to load users. Please try again later.
        </Alert>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="pb-24 sm:pb-10">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="inline-flex size-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
            <IconUsers size={21} stroke={1.8} />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Administration
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          </div>
        </div>
      </div>

      {users.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="font-semibold text-foreground">No users found</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Users will appear here when they exist in the system.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {users.map(user => (
            <Card key={user.id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-foreground">
                    {user.email}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    ID: {user.id}
                  </p>
                </div>
                <Badge
                  color={user.admin ? 'brand' : 'gray'}
                  variant="light"
                  className="shrink-0"
                >
                  {user.admin ? 'Admin' : 'User'}
                </Badge>
              </div>

              <div className="mt-5 rounded-md border border-border bg-muted p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Shortlinks
                </p>
                <p className="mt-1 text-2xl font-semibold text-foreground">
                  {user.shortlinks_count}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
