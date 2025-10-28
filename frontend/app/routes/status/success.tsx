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

export const meta: MetaFunction = () => {
  return [
    { title: 'Success - Link Shortened | Kurz' },
    {
      name: 'description',
      content: 'Your link has been successfully shortened!',
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
      // This could be a single usage of variable
      // but it's on stupid setState because of Hydration
      // https://react.dev/link/hydration-mismatch
      setShortlink(location.state.shortlink);
      setEmail(location.state.email);
    } else {
      // Redirect to home if no shortlink data
      navigate('/');
    }
  }, [location.state, navigate]);

  if (!shortlink) {
    return null;
  }

  return (
    <Layout>
      <div className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6 py-8 sm:py-12">
        <div className="max-w-2xl w-full">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-green-500/10 border border-green-500/20 mb-6">
              <IconCheck
                size={32}
                className="sm:hidden text-green-400"
                stroke={2.5}
              />
              <IconCheck
                size={40}
                className="hidden sm:block text-green-400"
                stroke={2.5}
              />
            </div>

            <h1 className="text-3xl sm:text-5xl font-bold mb-4">
              Link Shortened Successfully!
            </h1>
            <p className="text-lg text-zinc-400 mb-8">
              Your short link is ready to share
            </p>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 sm:p-8 backdrop-blur-sm mb-6">
            <div className="mb-6">
              <label className="text-sm font-semibold text-zinc-400 mb-2 block">
                Original URL
              </label>
              <p className="text-zinc-300 break-all text-sm sm:text-base">
                {shortlink.original_url}
              </p>
            </div>

            <div className="mb-6">
              <label className="text-sm font-semibold text-zinc-400 mb-2 block">
                Short URL
              </label>
              <div className="flex items-center gap-2 p-4 bg-black/50 border border-zinc-800 rounded-lg">
                <a
                  href={shortlink.short_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-violet-400 hover:text-violet-300 transition-colors break-all text-sm sm:text-base"
                >
                  {shortlink.short_url}
                </a>
                <button
                  onClick={() => copy(shortlink.short_url)}
                  className="p-2 rounded-lg bg-violet-600 hover:bg-violet-500 transition-all flex items-center justify-center gap-2 shrink-0"
                  title={copied ? 'Copied!' : 'Copy to clipboard'}
                >
                  {copied ? (
                    <IconCheck size={20} stroke={2.5} />
                  ) : (
                    <IconCopy size={20} stroke={2.5} />
                  )}
                </button>
              </div>
              {copied && (
                <p className="text-green-400 text-sm mt-2 text-center">
                  ✓ Copied to clipboard!
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => copy(shortlink.short_url)}
                className="px-6 py-3 bg-violet-600 hover:bg-violet-500 rounded-lg font-semibold transition-all flex items-center justify-center gap-2"
              >
                <IconCopy size={20} />
                Copy Link
              </button>
              <a
                href={shortlink.short_url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg font-semibold transition-all flex items-center justify-center gap-2 border border-zinc-700"
              >
                <IconExternalLink size={20} />
                Visit Link
              </a>
            </div>
          </div>
          <div className="text-center space-y-4">
            <div className="space-y-4">
              {user ? (
                <div className="bg-violet-500/10 border border-violet-500/30 rounded-lg p-4 backdrop-blur-sm">
                  <div className="flex gap-3">
                    <div className="flex-1 text-left">
                      <h3 className="text-sm font-semibold text-violet-400 mb-2">
                        Link Created Successfully!
                      </h3>
                      <p className="text-sm text-violet-200/90 mb-3">
                        Your link is now available in your dashboard. Access it
                        to view analytics and manage your links.
                      </p>
                      <a
                        href="/app"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg font-semibold text-sm transition-all"
                      >
                        Go to Dashboard
                        <IconExternalLink size={16} />
                      </a>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {email && <EmailAlert email={email} />}
                  <ExpirationAlert />
                  {!email && <SignInCTA />}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
