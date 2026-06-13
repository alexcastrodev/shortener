import { Button, Stack, Text, TextInput, Title } from '@mantine/core';
import { IconMail } from '@tabler/icons-react';
import { useLogin } from './hooks/useLogin';
import type { MetaFunction } from 'react-router';
import { BrandMark, Card, ThemeToggle } from '@internal/ui';

export const ssr = false;

export const meta: MetaFunction = () => {
  return [{ title: 'Sign in - Kurz' }];
};

export default function Login() {
  const { form, handleRequestLogin, loading } = useLogin();

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <BrandMark />
        <ThemeToggle />
      </div>

      <div className="mx-auto flex min-h-[calc(100vh-88px)] max-w-md items-center">
        <Card className="w-full p-6 sm:p-8">
          <form onSubmit={form.onSubmit(handleRequestLogin)}>
            <Stack gap="lg">
              <div className="text-center">
                <Title order={1} size="h2" className="text-foreground">
                  Welcome back
                </Title>
                <Text size="sm" className="mt-2 text-muted-foreground">
                  Enter your email to access your account.
                </Text>
              </div>

              <TextInput
                label="Your email"
                placeholder="me@gmail.com"
                leftSection={<IconMail size={16} />}
                key={form.key('email')}
                {...form.getInputProps('email')}
                required
              />

              <Button fullWidth type="submit" loading={loading} color="brand">
                Sign in
              </Button>
            </Stack>
          </form>
        </Card>
      </div>
    </main>
  );
}
