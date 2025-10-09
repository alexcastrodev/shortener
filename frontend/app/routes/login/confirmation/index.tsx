import {
  Button,
  Center,
  Group,
  Paper,
  PinInput,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useConfirmation } from './hooks/use-confirmation';
import type { MetaFunction } from 'react-router';

export const ssr = false;

export const meta: MetaFunction = () => {
  return [{ title: 'Kurz Auth' }];
};

export default function Login() {
  const { form, handleRequestLogin, email, handleChange, loading } =
    useConfirmation();

  return (
    <Center style={{ height: '100dvh' }}>
      <Paper radius="md" p="lg" withBorder w={500} maw={500}>
        <form
          onSubmit={form.onSubmit(handleRequestLogin)}
          id="confirmation-form"
        >
          <Stack>
            <Title ta="center">Sign In </Title>
            <Text c="dimmed" fz="sm" ta="center">
              Check {email} inbox, we have sent you a code to sign in
            </Text>

            <Group mb="md" mt="xl" justify="center">
              <PinInput
                autoFocus
                placeholder="0"
                key={form.key('code')}
                inputMode="numeric"
                length={7}
                {...form.getInputProps('code')}
                onChange={handleChange}
              />
            </Group>
            <Group justify="center" mt="lg">
              <Button fullWidth type="submit" loading={loading}>
                Sign In
              </Button>
            </Group>
          </Stack>
        </form>
      </Paper>
    </Center>
  );
}
