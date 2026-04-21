import {
  Container,
  Text,
  Group,
  Loader,
  Center,
  Switch,
  ScrollArea,
  Badge,
} from '@mantine/core';
import { IconLock } from '@tabler/icons-react';
import { Card, CardTitle, CardDescription, Alert } from '@internal/ui';
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
import { useMemo } from 'react';
import {
  type MRT_ColumnDef,
  MantineReactTable,
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

  const patchShortlink = (updated: Shortlink) => {
    queryClient.setQueryData<AdminGetShortlinksResponse>(
      adminGetShortlinksKey,
      (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          shortlink: prev.shortlink.map((s) =>
            s.id === updated.id ? updated : s
          ),
        };
      }
    );
  };

  const toggleSafeMutation = useToggleShortlinkSafe({
    onSuccess: (data) => patchShortlink(data.shortlink),
  });

  const toggleActiveMutation = useToggleShortlinkActive({
    onSuccess: (data) => patchShortlink(data.shortlink),
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
            {row.original.title || 'untitled'}
          </Text>
        ),
      },
      {
        accessorKey: 'original_url',
        header: 'URL',
        Cell: ({ row }) => (
          <Text maw={300} className="truncate whitespace-pre-wrap break-words">
            {row.original.original_url}
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
        accessorKey: 'created_by_guest',
        header: 'Source',
        Cell: ({ row }) =>
          row.original.created_by_guest ? (
            <Badge size="sm" variant="dot" color="yellow">
              Guest
            </Badge>
          ) : (
            <Badge size="sm" variant="dot" color="blue">
              Authenticated
            </Badge>
          ),
      },
      {
        accessorKey: 'safe',
        header: 'Safe',
        enableSorting: false,
        Cell: ({ row }) => (
          <Group>
            <Switch
              checked={Boolean(row.original.safe)}
              onChange={() => toggleSafeMutation.mutate(row.original.id)}
              size="sm"
              aria-label={`toggle-safe-${row.original.id}`}
            />
          </Group>
        ),
      },
      {
        accessorKey: 'is_active',
        header: 'Active',
        enableSorting: false,
        Cell: ({ row }) => (
          <Group>
            <Switch
              checked={row.original.inactive_at == null}
              onChange={() => toggleActiveMutation.mutate(row.original.id)}
              size="sm"
              aria-label={`toggle-active-${row.original.id}`}
            />
          </Group>
        ),
      },
    ],
    [toggleSafeMutation, toggleActiveMutation]
  );

  const table = useMantineReactTable({
    columns,
    data: shortlinksData?.shortlink || [],
    enableColumnActions: false,
    enableColumnFilters: true,
    enableSorting: true,
    paginationDisplayMode: 'pages',
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
          Failed to load shortlinks. Please try again later.
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="xl" py="xl">
      <Card className="p-6">
        <Group justify="space-between" mb="lg">
          <div>
            <CardTitle icon={<IconLock size={28} />}>
              Shortlinks Management
            </CardTitle>
            <CardDescription>
              Manage all shortlinks in the system
            </CardDescription>
          </div>
        </Group>

        <ScrollArea>
          <MantineReactTable table={table} />
        </ScrollArea>
      </Card>
    </Container>
  );
}
