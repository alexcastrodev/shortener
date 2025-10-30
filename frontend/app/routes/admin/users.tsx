import {
  Container,
  Text,
  Badge,
  Group,
  Loader,
  Center,
  ScrollArea,
} from '@mantine/core';
import { IconUsers, IconLock } from '@tabler/icons-react';
import { Card, CardTitle, CardDescription, Alert } from '@internal/ui';
import { useGetLoggedUser } from '@internal/core/actions/get-logged-user/get-logged-user.hook';
import { useGetManageUsers } from '@internal/core/actions/get-manage-users/get-manage-users.hook';
import { useMemo } from 'react';
import {
  type MRT_ColumnDef,
  MantineReactTable,
  useMantineReactTable,
} from 'mantine-react-table';

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

  const columns = useMemo<MRT_ColumnDef<any>[]>(
    () => [
      {
        accessorKey: 'id',
        header: 'ID',
      },
      {
        accessorKey: 'email',
        header: 'Email',
      },
      {
        accessorKey: 'admin',
        header: 'Role',
        enableSorting: false,
        Cell: ({ row }) => (
          <Badge color={row.original.admin ? 'blue' : 'gray'} variant="light">
            {row.original.admin ? 'Admin' : 'User'}
          </Badge>
        ),
      },
      {
        accessorKey: 'shortlinks_count',
        header: 'Shortlinks',
      },
    ],
    []
  );

  const table = useMantineReactTable({
    columns,
    data: usersData?.user || [],
    enableColumnActions: false,
    enableColumnFilters: true,
    paginationDisplayMode: 'pages',
    enableSorting: true,
    mantineTableProps: {
      highlightOnHover: false,
      striped: 'odd',
      withColumnBorders: true,
      withRowBorders: true,
      withTableBorder: true,
    },
  });

  if (data && !data.user?.admin) {
    return (
      <Container size="xl" py="xl">
        <Alert
          variant="error"
          icon={<IconLock size={24} />}
          title="Access Denied"
        >
          You don't have permission to access this page. This area is restricted
          to administrators only.
        </Alert>
      </Container>
    );
  }

  if (isLoading) {
    return (
      <Container size="xl" py="xl">
        <Center>
          <Loader size="lg" color="violet" />
        </Center>
      </Container>
    );
  }

  if (error) {
    return (
      <Container size="xl" py="xl">
        <Alert variant="error" icon={<IconLock size={24} />} title="Error">
          Failed to load users. Please try again later.
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="xl" py="xl">
      <Card className="p-6">
        <Group justify="space-between" mb="lg">
          <div>
            <CardTitle icon={<IconUsers size={28} />}>
              Users Management
            </CardTitle>
            <CardDescription>Manage all users in the system</CardDescription>
          </div>
        </Group>

        <ScrollArea>
          <MantineReactTable table={table} />
        </ScrollArea>
      </Card>
    </Container>
  );
}
