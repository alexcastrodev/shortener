import { Button, PasswordInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconLock } from '@tabler/icons-react';
import { data, isRouteErrorResponse } from 'react-router';
import { BrandMark, Card } from '@internal/ui';
import { getLockedShortlink } from '@internal/core/actions/get-locked-shortlink/get-locked-shortlink.service';
import { useUnlockShortlink } from '@internal/core/actions/unlock-shortlink/unlock-shortlink.hook';
import type { Route } from './+types/$shortCode';

export async function loader({ params }: Route.LoaderArgs) {
  const shortlink = await getLockedShortlink(params.shortCode);
  if (!shortlink) throw data('Link not found', { status: 404 });

  return { shortCode: shortlink.short_code };
}

// entry.server sets the full CSP in production; these keep framing blocked
// in every environment.
export function headers() {
  return {
    'Content-Security-Policy': "frame-ancestors 'none'",
    'X-Frame-Options': 'DENY',
  };
}

export function meta() {
  return [
    { title: 'Protected link - Kurz' },
    // Password pages have nothing worth indexing.
    { name: 'robots', content: 'noindex, nofollow' },
  ];
}

function errorMessage(status?: number) {
  if (status === 401) return 'Wrong password. Try again.';
  if (status === 429) return 'Too many attempts. Wait a few minutes and try again.';
  if (status === 404) return 'This link no longer works.';
  return 'Something went wrong, please try again later.';
}

export default function UnlockShortlink({ loaderData }: Route.ComponentProps) {
  const { shortCode } = loaderData;
  const form = useForm({
    mode: 'uncontrolled',
    initialValues: { password: '' },
    validate: { password: value => (value ? null : 'Enter the password') },
  });

  const { mutate, isPending } = useUnlockShortlink({
    onSuccess: ({ original_url }) => {
      // Destinations are validated as http(s) when saved; never follow
      // anything else (javascript:, data:).
      if (/^https?:\/\//i.test(original_url)) window.location.replace(original_url);
      else form.setFieldError('password', 'This link cannot be opened.');
    },
    onError: error => {
      form.setFieldError('password', errorMessage(error.status));
    },
  });

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-foreground">
      <div className="mb-8">
        <BrandMark />
      </div>
      <Card className="w-full max-w-sm p-6">
        <div className="mb-4 inline-flex size-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
          <IconLock size={20} stroke={1.8} />
        </div>
        <h1 className="text-lg font-semibold">This link is protected</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the password to continue.
        </p>
        <form
          className="mt-5 space-y-4"
          onSubmit={form.onSubmit(({ password }) =>
            mutate({ shortCode, password, referer: document.referrer })
          )}
        >
          <PasswordInput
            label="Password"
            autoComplete="off"
            autoFocus
            key={form.key('password')}
            {...form.getInputProps('password')}
          />
          <Button type="submit" fullWidth loading={isPending} color="brand">
            Continue
          </Button>
        </form>
      </Card>
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const notFound = isRouteErrorResponse(error) && error.status === 404;

  return (
    <div className="min-h-screen bg-background px-4 pt-24 text-center text-foreground">
      <h1 className="text-xl font-semibold">
        {notFound ? 'Link not found' : 'Something went wrong'}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {notFound
          ? 'This link does not exist or is no longer available.'
          : 'Please try again in a moment.'}
      </p>
      <a
        href="/"
        className="mt-6 inline-block text-sm font-medium text-primary hover:underline"
      >
        Go to Kurz
      </a>
    </div>
  );
}
