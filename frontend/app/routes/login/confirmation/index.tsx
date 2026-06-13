import { Button, Group, PinInput, Stack, Text, Title } from '@mantine/core';
import { IconMail } from '@tabler/icons-react';
import { useConfirmation } from './hooks/use-confirmation';
import type { MetaFunction } from 'react-router';
import { BrandMark, Card, ThemeToggle } from '@internal/ui';

export const ssr = false;

export const meta: MetaFunction = () => {
  return [{ title: 'Verify email - Kurz' }];
};

export default function Login() {
  const { form, handleRequestLogin, email, handleChange, loading } =
    useConfirmation();

  return (
    <main className="min-h-screen bg-background px-4 py-6 text-foreground">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <BrandMark />
        <ThemeToggle />
      </div>

      <div className="mx-auto flex min-h-[calc(100vh-88px)] max-w-md items-center">
        <Card className="w-full p-6 sm:p-8">
          <form
            onSubmit={form.onSubmit(handleRequestLogin)}
            id="confirmation-form"
          >
            <Stack gap="lg">
              <div className="text-center">
                <Title order={1} size="h2" className="text-foreground">
                  Verify your email
                </Title>
                <div className="mt-3 flex items-center justify-center gap-2">
                  <IconMail size={16} className="text-primary" />
                  <Text size="sm" className="text-muted-foreground">
                    {email}
                  </Text>
                </div>
                <Text size="sm" className="mt-3 text-muted-foreground">
                  Enter the 7-digit code we sent to your email.
                </Text>
              </div>

              <Group justify="center">
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

              <Button fullWidth type="submit" loading={loading} color="brand">
                Verify and sign in
              </Button>
            </Stack>
          </form>
        </Card>
      </div>
    </main>
  );
}
