import {
  Container,
  Title,
  Text,
  Paper,
  Alert,
  Table,
  Badge,
  Group,
  Loader,
  Center,
} from '@mantine/core';
import { IconUsers, IconLock } from '@tabler/icons-react';
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

  const rows = (usersData?.user || []).map(user => (
    <Table.Tr key={user.id}>
      <Table.Td>{user.id}</Table.Td>
      <Table.Td>{user.email}</Table.Td>
      <Table.Td>
        <Badge color={user.admin ? 'blue' : 'gray'} variant="light">
          {user.admin ? 'Admin' : 'User'}
        </Badge>
      </Table.Td>
      <Table.Td>{user.shortlinks_count}</Table.Td>
    </Table.Tr>
  ));

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

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Id</Table.Th>
              <Table.Th>Email</Table.Th>
              <Table.Th>Role</Table.Th>
              <Table.Th>Shortlinks</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows && rows.length > 0 ? (
              rows
            ) : (
              <Table.Tr>
                <Table.Td colSpan={4}>
                  <Text ta="center" c="dimmed">
                    No users found
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
