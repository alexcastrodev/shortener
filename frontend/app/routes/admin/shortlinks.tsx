import {
  Container,
  Title,
  Text,
  Paper,
  Alert,
  Table,
  Group,
  Loader,
  Center,
  Switch,
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

  const rows = (shortlinksData?.shortlink || []).map((s: Shortlink) => (
    <Table.Tr key={s.id}>
      <Table.Td>{s.id}</Table.Td>
      <Table.Td>{s.title || s.original_url}</Table.Td>
      <Table.Td>{s.short_code}</Table.Td>
      <Table.Td>{s.events_count}</Table.Td>
      <Table.Td>
        <Group>
          <Switch
            checked={Boolean(s.safe)}
            onChange={() => toggleMutation.mutate(s.id)}
            size="sm"
            aria-label={`toggle-safe-${s.id}`}
          />
        </Group>
      </Table.Td>
    </Table.Tr>
  ));

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

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Id</Table.Th>
              <Table.Th>Title / URL</Table.Th>
              <Table.Th>Code</Table.Th>
              <Table.Th>Events</Table.Th>
              <Table.Th>Safe</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows && rows.length > 0 ? (
              rows
            ) : (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text ta="center" c="dimmed">
                    No shortlinks found
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Paper>
    </Container>
  );
}
