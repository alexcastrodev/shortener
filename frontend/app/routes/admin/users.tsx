import {
  Container,
  Title,
  Text,
  Paper,
  Alert,
  Badge,
  Group,
  Loader,
  Center,
  ScrollArea,
} from '@mantine/core';
import { IconUsers, IconLock } from '@tabler/icons-react';
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
        <Alert icon={<IconLock size={24} />} title="Access Denied" color="red">
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
          <Loader size="lg" />
        </Center>
      </Container>
    );
  }

  if (error) {
    return (
      <Container size="xl" py="xl">
        <Alert icon={<IconLock size={24} />} title="Error" color="red">
          Failed to load users. Please try again later.
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="xl" py="xl">
      <Paper shadow="sm" p="xl" radius="md" withBorder>
        <Group justify="space-between" mb="lg">
          <div>
            <Title order={2}>
              <IconUsers size={28} style={{ marginRight: '0.5rem' }} />
              Users Management
            </Title>
            <Text c="dimmed" size="sm">
              Manage all users in the system
            </Text>
          </div>
        </Group>

        <ScrollArea>
          <MantineReactTable table={table} />
        </ScrollArea>
      </Paper>
    </Container>
  );
}
