import { IconCheck, IconCopy, IconExternalLink } from '@tabler/icons-react';
import { useLocation, useNavigate } from 'react-router';
import { useClipboard } from '@mantine/hooks';
import { useEffect, useState } from 'react';
import type { Shortlink } from '@internal/core/types/Shortlink';
import type { MetaFunction } from 'react-router';
import { EmailAlert } from '../../modules/success-alerts/email-alert';
import { ExpirationAlert } from '../../modules/success-alerts/expiration-alert';
import { SignInCTA } from '../../modules/success-alerts/sign-in-cta';
import { Layout } from '../../layout/web-layout';
import { useAuth } from '../../modules/auth/use-auth';
import { Card } from '@internal/ui';

export const meta: MetaFunction = () => {
  return [
    { title: 'Success - Link Created | Kurz' },
    {
      name: 'description',
      content: 'Your short link has been created.',
    },
  ];
};

export default function StatusSuccess() {
  const location = useLocation();
  const navigate = useNavigate();
  const { copy, copied } = useClipboard({ timeout: 2000 });
  const { user } = useAuth();
  const [shortlink, setShortlink] = useState<Shortlink | null>(null);
  const [email, setEmail] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (location.state?.shortlink) {
      setShortlink(location.state.shortlink);
      setEmail(location.state.email);
    } else {
      navigate('/');
    }
  }, [location.state, navigate]);

  if (!shortlink) {
    return null;
  }

  return (
    <Layout>
      <section className="mx-auto flex min-h-[calc(100vh-65px)] max-w-3xl items-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="w-full">
          <div className="mb-8 text-center">
            <div className="mb-5 inline-flex size-14 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200">
              <IconCheck size={30} stroke={2.2} />
            </div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Link created
            </h1>
            <p className="mt-3 text-muted-foreground">
              Your short link is ready to use.
            </p>
          </div>

          <Card className="mb-6 p-5 sm:p-6">
            <div className="space-y-5">
              <div>
                <p className="mb-2 text-sm font-semibold text-muted-foreground">
                  Original URL
                </p>
                <p className="break-all text-sm text-foreground sm:text-base">
                  {shortlink.original_url}
                </p>
              </div>

              <div>
                <p className="mb-2 text-sm font-semibold text-muted-foreground">
                  Short URL
                </p>
                <div className="flex items-center gap-2 rounded-md border border-border bg-background p-3">
                  <a
                    href={shortlink.short_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 break-all text-sm font-medium text-primary transition-colors hover:underline sm:text-base"
                  >
                    {shortlink.short_url}
                  </a>
                  <button
                    onClick={() => copy(shortlink.short_url)}
                    className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
                    title={copied ? 'Copied' : 'Copy to clipboard'}
                  >
                    {copied ? (
                      <IconCheck size={19} stroke={2.3} />
                    ) : (
                      <IconCopy size={19} stroke={2.3} />
                    )}
                  </button>
                </div>
                {copied && (
                  <p className="mt-2 text-center text-sm text-emerald-700 dark:text-emerald-200">
                    Copied to clipboard
                  </p>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  onClick={() => copy(shortlink.short_url)}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <IconCopy size={18} />
                  Copy link
                </button>
                <a
                  href={shortlink.short_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-border bg-card px-5 text-sm font-semibold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <IconExternalLink size={18} />
                  Visit link
                </a>
              </div>
            </div>
          </Card>

          <div className="space-y-4">
            {user ? (
              <Card className="p-4">
                <h3 className="text-sm font-semibold text-foreground">
                  Link available in your dashboard
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Open your dashboard to review analytics and manage your
                  links.
                </p>
                <a
                  href="/app"
                  className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Go to dashboard
                  <IconExternalLink size={16} />
                </a>
              </Card>
            ) : (
              <>
                {email && <EmailAlert email={email} />}
                <ExpirationAlert />
                {!email && <SignInCTA />}
              </>
            )}
          </div>
        </div>
      </section>
    </Layout>
  );
}
