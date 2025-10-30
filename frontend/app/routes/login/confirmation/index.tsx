import {
  Button,
  Center,
  Group,
  PinInput,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { IconLink, IconMail } from '@tabler/icons-react';
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
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-white relative overflow-hidden">
      <div className="fixed inset-0 opacity-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(124,58,237,0.3) 1px, transparent 0)`,
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      <div className="fixed inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/50 pointer-events-none" />

      <Center style={{ minHeight: '100vh' }} className="relative z-10">
        <div className="w-full max-w-md mx-4">
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="w-10 h-10 bg-violet-600 rounded-lg flex items-center justify-center">
              <IconLink size={24} stroke={2.5} />
            </div>
            <span className="text-2xl font-semibold">Kurz</span>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-8 backdrop-blur-xl shadow-2xl">
            <form
              onSubmit={form.onSubmit(handleRequestLogin)}
              id="confirmation-form"
            >
              <Stack gap="lg">
                <div className="text-center">
                  <Title order={2} className="text-white mb-2">
                    Verify Your Email
                  </Title>
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <IconMail size={16} className="text-violet-400" />
                    <Text size="sm" className="text-zinc-400">
                      {email}
                    </Text>
                  </div>
                  <Text size="sm" className="text-zinc-400">
                    Enter the 7-digit code we sent to your email
                  </Text>
                </div>

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
                  <Button
                    fullWidth
                    type="submit"
                    loading={loading}
                    size="md"
                    color="violet"
                  >
                    Verify & Sign In
                  </Button>
                </Group>
              </Stack>
            </form>
          </div>

          <Text size="xs" mt="lg" className="text-center text-zinc-500">
            Didn't receive the code? Check your spam folder
          </Text>
        </div>
      </Center>
    </div>
  );
}
