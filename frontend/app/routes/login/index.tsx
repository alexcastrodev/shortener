import {
  Button,
  Center,
  Group,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useLogin } from './hooks/useLogin';

export default function Login() {
  const { form, handleRequestLogin } = useLogin();
  return (
    <Center style={{ height: '100dvh' }}>
      <Paper radius="md" p="lg" withBorder w={500} maw={500}>
        <form onSubmit={form.onSubmit(handleRequestLogin)}>
          <Stack>
            <Title ta="center">Welcome</Title>
            <Text c="dimmed" fz="sm" ta="center">
              Enter your email to sign in to your account
            </Text>

            <TextInput
              withAsterisk
              label="Your email"
              placeholder="me@gmail.com"
              key={form.key('email')}
              {...form.getInputProps('email')}
            />
            <Group justify="center" mt="lg">
              <Button fullWidth type="submit">
                Sign In
              </Button>
            </Group>
          </Stack>
        </form>
      </Paper>
    </Center>
  );
}
