import {
  Button,
  Center,
  Group,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconLink, IconMail } from '@tabler/icons-react';
import { useLogin } from './hooks/useLogin';
import type { MetaFunction } from 'react-router';

export const ssr = false;

export const meta: MetaFunction = () => {
  return [{ title: 'Kurz Auth' }];
};

export default function Login() {
  const { form, handleRequestLogin, loading } = useLogin();
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
            <form onSubmit={form.onSubmit(handleRequestLogin)}>
              <Stack gap="lg">
                <div className="text-center">
                  <Title order={2} className="text-white mb-2">
                    Welcome Back
                  </Title>
                  <Text size="sm" className="text-zinc-400">
                    Enter your email to sign in to your account
                  </Text>
                </div>

                <TextInput
                  label={<span className="text-zinc-300">Your email</span>}
                  placeholder="me@gmail.com"
                  leftSection={<IconMail size={16} />}
                  key={form.key('email')}
                  {...form.getInputProps('email')}
                  required
                />
                <Group justify="center" mt="md">
                  <Button
                    fullWidth
                    type="submit"
                    loading={loading}
                    size="md"
                    color="violet"
                  >
                    Sign In
                  </Button>
                </Group>
              </Stack>
            </form>
          </div>

          <Text mt="lg" size="xs" className="text-center text-zinc-500">
            We'll send you a magic link to sign in securely
          </Text>
        </div>
      </Center>
    </div>
  );
}
