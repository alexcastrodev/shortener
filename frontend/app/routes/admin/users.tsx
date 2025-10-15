import { Container, Title, Text, Paper, Alert } from '@mantine/core';
import { IconUsers, IconLock } from '@tabler/icons-react';
import { useEffect } from 'react';
import { useGetLoggedUser } from '@internal/core/actions/get-logged-user/get-logged-user.hook';
import { useNavigate } from 'react-router';

export const ssr = false;

export function meta() {
  return [
    { title: 'Users - Administration' },
    { name: 'description', content: 'Manage users' },
  ];
}

export default function UsersPage() {
  const { data } = useGetLoggedUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (data && !data.user?.admin) {
      navigate('/app');
    }
  }, [data, navigate]);

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

  return (
    <Container size="xl" py="xl">
      <Paper shadow="sm" p="xl" radius="md" withBorder>
        <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
          <IconUsers size={64} style={{ margin: '0 auto', opacity: 0.5 }} />
          <Title order={2} mt="xl">
            Users Management
          </Title>
          <Text c="dimmed" mt="md">
            This page is under construction. User management features will be
            available soon.
          </Text>
        </div>
      </Paper>
    </Container>
  );
}
