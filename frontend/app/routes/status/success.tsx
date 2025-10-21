import {
  IconCheck,
  IconCopy,
  IconExternalLink,
  IconHome,
  IconAlertTriangle,
} from '@tabler/icons-react';
import { useLocation, useNavigate } from 'react-router';
import { useClipboard } from '@mantine/hooks';
import { useEffect, useState } from 'react';
import type { Shortlink } from '@internal/core/types/Shortlink';
import type { MetaFunction } from 'react-router';

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
  const [shortlink, setShortlink] = useState<Shortlink | null>(null);

  useEffect(() => {
    if (location.state?.shortlink) {
      setShortlink(location.state.shortlink);
    } else {
      // Redirect to home if no shortlink data
      navigate('/');
    }
  }, [location.state, navigate]);

  if (!shortlink) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-white overflow-hidden flex flex-col">
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

      <nav className="relative z-50 px-4 sm:px-6 py-4 sm:py-5 border-b border-zinc-800 bg-black/50 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 bg-violet-600 rounded-lg flex items-center justify-center">
              <IconHome size={18} className="sm:hidden" stroke={2.5} />
              <IconHome size={20} className="hidden sm:block" stroke={2.5} />
            </div>
            <span className="text-lg sm:text-xl font-semibold">Kurz</span>
          </a>

          <div className="flex items-center gap-3">
            <a
              href="/"
              className="text-sm px-4 sm:px-5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 transition-all border border-zinc-800 hover:border-zinc-700 flex items-center gap-2"
            >
              <IconHome size={16} />
              <span className="hidden sm:inline">Back to Home</span>
              <span className="sm:hidden">Home</span>
            </a>
            <a
              href="/app"
              className="text-sm px-4 sm:px-5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 transition-all border border-zinc-800 hover:border-zinc-700"
            >
              Sign in
            </a>
          </div>
        </div>
      </nav>

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
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 backdrop-blur-sm">
                <div className="flex gap-3">
                  <div className="flex-shrink-0">
                    <IconAlertTriangle size={20} className="text-yellow-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-yellow-400 mb-1">
                      Link Expiration Policy
                    </h3>
                    <p className="text-sm text-yellow-200/80">
                      Links will be automatically deleted after 30 days without
                      access
                    </p>

                    <p className="text-sm text-yellow-200/80 mt-3">
                      All links are checked by Google Safe Browsing, if your
                      link does not work, MAYBE was blocked by Safety Service.
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-sm text-zinc-500">
                <p>
                  Want to track clicks and manage your links?{' '}
                  <a
                    href="/app"
                    className="text-violet-400 hover:text-violet-300 transition-colors"
                  >
                    Sign in for free
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="relative z-10 border-t border-zinc-800 bg-black/50 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-violet-600 rounded flex items-center justify-center">
                <IconHome size={16} stroke={2.5} />
              </div>
              <span className="font-semibold">Kurz - Free Link Shortener</span>
            </div>

            <div className="text-sm text-zinc-500 text-center sm:text-right">
              © 2025 Kurz. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
