import { Layout } from '@internal/ui';
import { IconExternalLink, IconClipboard } from '@tabler/icons-react';
import { useNavigate, useParams } from 'react-router';
import { useGetShortlinkDetails } from '@internal/core/actions/get-shortlink-details/get-shortlink-details.hook';
import type { Route } from '../../+types/root';
import { notifications } from '@mantine/notifications';
import { Button } from '@mantine/core';
import { useClipboard } from '@mantine/hooks';
import { Statistics } from './components/statistics';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Link - Shortener' },
    { name: 'description', content: 'Show link details' },
  ];
}

export const ssr = false;

export default function Page() {
  const navigate = useNavigate();
  const params = useParams();
  const id = params.id;
  const { copy } = useClipboard({ timeout: 2000 });

  const { data: link, isLoading, error } = useGetShortlinkDetails(id || '');

  if (error) {
    return (
      <Layout.Main>
        <div className="px-6 py-8">
          <div className="max-w-3xl mx-auto">
            <div className="bg-red-900/30 border border-red-800 rounded-lg p-4 text-red-300">
              Failed to load link
            </div>
          </div>
        </div>
      </Layout.Main>
    );
  }

  if (isLoading || !link) {
    return (
      <Layout.Main>
        <div className="px-6 py-8">
          <div className="max-w-3xl mx-auto animate-pulse">
            <div className="h-6 bg-zinc-800 rounded w-1/3 mb-4" />
            <div className="h-40 bg-zinc-800 rounded" />
          </div>
        </div>
      </Layout.Main>
    );
  }

  return (
    <Layout.Main>
      <div className="px-6 py-10">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <Button
              variant="outline"
              onClick={() => navigate(-1)}
              styles={{
                root: {
                  borderColor: '#3f3f46',
                  color: '#a1a1aa',
                  '&:hover': {
                    backgroundColor: 'rgba(63, 63, 70, 0.5)',
                    color: '#ffffff',
                  },
                },
              }}
            >
              ← Back
            </Button>
          </div>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-6 backdrop-blur-xl shadow-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-2xl font-semibold text-white">
                  {link.title ?? `Link #${link.id}`}
                </h3>
                <p className="text-sm text-zinc-400 mt-1">
                  ID: {link.id} • Clicks: {link.events_count}
                </p>

                <div className="mt-6">
                  <p className="text-sm font-semibold text-zinc-300">
                    Destination:
                  </p>
                  <a
                    href={link.original_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-violet-400 hover:text-violet-300 break-words"
                  >
                    {link.original_url}
                  </a>
                </div>

                <div className="mt-4">
                  <p className="text-sm font-semibold text-zinc-300">
                    Short URL:
                  </p>
                  <a
                    href={link.short_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-violet-400 hover:text-violet-300 break-words"
                  >
                    {link.short_url}
                  </a>
                </div>

                <div className="mt-4">
                  <p className="text-sm font-semibold text-zinc-300">
                    Last accessed:
                  </p>
                  <div className="text-sm text-zinc-400">
                    {link.last_accessed_at
                      ? new Date(link.last_accessed_at).toLocaleString()
                      : 'Never'}
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-between">
                <div className="flex items-center justify-end gap-3">
                  <a
                    href={link.short_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-zinc-800 text-sm font-medium text-zinc-300 hover:bg-zinc-800/50"
                  >
                    <IconExternalLink size={16} />
                    Open
                  </a>

                  <Button
                    variant="outline"
                    onClick={async () => {
                      copy(link.short_url);
                      notifications.show({
                        title: 'Copied',
                        message: 'Short URL copied to clipboard',
                        color: 'green',
                      });
                    }}
                    styles={{
                      root: {
                        borderColor: '#3f3f46',
                        color: '#a1a1aa',
                        backgroundColor: 'rgba(39, 39, 42, 0.5)',
                        '&:hover': {
                          backgroundColor: 'rgba(63, 63, 70, 0.5)',
                          color: '#ffffff',
                        },
                      },
                    }}
                    aria-label="Copy short url"
                  >
                    <IconClipboard size={18} />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <Statistics />
        </div>
      </div>
    </Layout.Main>
  );
}
