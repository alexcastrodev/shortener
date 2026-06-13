import {
  IconArrowLeft,
  IconClipboard,
  IconExternalLink,
} from '@tabler/icons-react';
import { useNavigate, useParams } from 'react-router';
import { useGetShortlinkDetails } from '@internal/core/actions/get-shortlink-details/get-shortlink-details.hook';
import type { Route } from '../../+types/root';
import { notifications } from '@mantine/notifications';
import { Button } from '@mantine/core';
import { useClipboard } from '@mantine/hooks';
import { Statistics } from './components/statistics';
import { Alert, Card, PageContainer } from '@internal/ui';

export function meta({}: Route.MetaArgs) {
  return [
    { title: 'Link - Kurz' },
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
      <PageContainer>
        <Alert title="Failed to load link">
          We could not load this link. Please try again later.
        </Alert>
      </PageContainer>
    );
  }

  if (isLoading || !link) {
    return (
      <PageContainer>
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded-md bg-muted" />
          <div className="h-48 rounded-lg bg-muted" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="pb-24 sm:pb-10">
      <div className="mb-6 flex items-center justify-between">
        <Button
          variant="subtle"
          color="gray"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => navigate(-1)}
        >
          Back
        </Button>
      </div>

      <Card className="p-5 sm:p-6">
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-foreground">
              {link.title ?? `Link #${link.id}`}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              ID: {link.id} | Clicks: {link.events_count}
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <p className="text-sm font-semibold text-muted-foreground">
                  Destination
                </p>
                <a
                  href={link.original_url}
                  target="_blank"
                  rel="noreferrer"
                  className="break-words text-sm font-medium text-primary hover:underline"
                >
                  {link.original_url}
                </a>
              </div>

              <div>
                <p className="text-sm font-semibold text-muted-foreground">
                  Short URL
                </p>
                <a
                  href={link.short_url}
                  target="_blank"
                  rel="noreferrer"
                  className="break-words text-sm font-medium text-primary hover:underline"
                >
                  {link.short_url}
                </a>
              </div>

              <div>
                <p className="text-sm font-semibold text-muted-foreground">
                  Last accessed
                </p>
                <div className="text-sm text-muted-foreground">
                  {link.last_accessed_at
                    ? new Date(link.last_accessed_at).toLocaleString()
                    : 'Never'}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row md:flex-col">
            <a
              href={link.short_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <IconExternalLink size={16} />
              Open
            </a>

            <Button
              variant="filled"
              color="brand"
              leftSection={<IconClipboard size={16} />}
              onClick={async () => {
                copy(link.short_url);
                notifications.show({
                  title: 'Copied',
                  message: 'Short URL copied to clipboard',
                  color: 'green',
                });
              }}
            >
              Copy
            </Button>
          </div>
        </div>
      </Card>

      <Statistics />
    </PageContainer>
  );
}
