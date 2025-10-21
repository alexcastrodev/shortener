import {
  Container,
  Title,
  Text,
  Paper,
  Alert,
  Group,
  Loader,
  Center,
  Switch,
  ScrollArea,
} from '@mantine/core';
import { IconLock } from '@tabler/icons-react';
import { useGetLoggedUser } from '@internal/core/actions/get-logged-user/get-logged-user.hook';
import {
  useAdminGetShortlinks,
  adminGetShortlinksKey,
} from '@internal/core/actions/admin-shortlink/admin-shortlink.hook';
import { useToggleShortlinkSafe } from '@internal/core/actions/admin-shortlink-toggle-safe/admin-shortlink-toggle-safe.hook';
import { useQueryClient } from '@tanstack/react-query';
import type { Shortlink } from '@internal/core/types/Shortlink';
import { useMemo } from 'react';
import {
  type MRT_ColumnDef,
  MRT_Table,
  useMantineReactTable,
} from 'mantine-react-table';

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

  const toggleMutation = useToggleShortlinkSafe({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminGetShortlinksKey });
    },
  });

  const columns = useMemo<MRT_ColumnDef<Shortlink>[]>(
    () => [
      {
        accessorKey: 'id',
        header: 'ID',
      },
      {
        accessorKey: 'title',
        header: 'Title',
        Cell: ({ row }) => (
          <Text maw={300} className="truncate whitespace-pre-wrap break-words">
            {row.original.title || row.original.original_url}
          </Text>
        ),
      },
      {
        accessorKey: 'short_code',
        header: 'Short Code',
      },
      {
        accessorKey: 'events_count',
        header: 'Events',
      },
      {
        accessorKey: 'user.email',
        header: 'User Email',
        Cell: ({ row }) => row.original.user?.email ?? '',
      },
      {
        accessorKey: 'safe',
        header: 'Safe',
        enableSorting: false,
        Cell: ({ row }) => (
          <Group>
            <Switch
              checked={Boolean(row.original.safe)}
              onChange={() => toggleMutation.mutate(row.original.id)}
              size="sm"
              aria-label={`toggle-safe-${row.original.id}`}
            />
          </Group>
        ),
      },
    ],
    [toggleMutation, shortlinksData]
  );

  const table = useMantineReactTable({
    columns,
    data: shortlinksData?.shortlink || [],
    enableColumnActions: false,
    enableColumnFilters: true,
    enablePagination: true,
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
          Failed to load shortlinks. Please try again later.
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
              <IconLock size={28} style={{ marginRight: '0.5rem' }} />
              Shortlinks Management
            </Title>
            <Text c="dimmed" size="sm">
              Manage all shortlinks in the system
            </Text>
          </div>
        </Group>

        <ScrollArea>
          <MRT_Table table={table} />
        </ScrollArea>
      </Paper>
    </Container>
  );
}
