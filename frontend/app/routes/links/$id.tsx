import { Layout } from '../../components/layout';
import { IconExternalLink, IconClipboard } from '@tabler/icons-react';
import { useNavigate, useParams } from 'react-router';
import { useGetShortlinkDetails } from '@internal/core/actions/get-shortlink-details/get-shortlink-details.hook';
import type { Route } from '../../+types/root';
import { notifications } from '@mantine/notifications';
import { Button } from '@mantine/core';
import { useClipboard } from '@mantine/hooks';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Link - Shortener' },
    { name: 'description', content: 'Show link details' },
  ];
}

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
          <div className="max-w-3xl mx-auto">Failed to load link</div>
        </div>
      </Layout.Main>
    );
  }

  if (isLoading || !link) {
    return (
      <Layout.Main>
        <div className="px-6 py-8">
          <div className="max-w-3xl mx-auto animate-pulse">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4" />
            <div className="h-40 bg-gray-200 dark:bg-gray-700 rounded" />
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
            <Button variant="outline" onClick={() => navigate(-1)}>
              ← Back
            </Button>
          </div>

          <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  {link.title ?? `Link #${link.id}`}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  ID: {link.id} • Clicks: {link.events_count}
                </p>

                <div className="mt-6">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                    Destination:
                  </p>
                  <a
                    href={link.original_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 dark:text-blue-400 break-words"
                  >
                    {link.original_url}
                  </a>
                </div>

                <div className="mt-4">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                    Short URL:
                  </p>
                  <a
                    href={link.short_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 dark:text-blue-400 break-words"
                  >
                    {link.short_url}
                  </a>
                </div>

                <div className="mt-4">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                    Last accessed:
                  </p>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
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
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
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
                    className="inline-flex items-center justify-center w-10 h-10 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
                    aria-label="Copy short url"
                  >
                    <IconClipboard size={18} />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout.Main>
  );
}
