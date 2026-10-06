import { Button, CopyButton, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@internal/ui';
import {
  getCalendarFeedKey,
  useCreateCalendarFeed,
  useDeleteCalendarFeed,
  useGetCalendarFeed,
} from '@internal/core/actions/calendar-feed/calendar-feed.hook';
import { formatDateTime } from '../../i18n/format';

export function CalendarFeedCard() {
  const { t } = useTranslation('calendarFeed');
  const queryClient = useQueryClient();
  const { data } = useGetCalendarFeed();
  const [url, setUrl] = useState<string | null>(null);
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: getCalendarFeedKey });
  const fail = () => notifications.show({ message: t('error'), color: 'red' });
  const { mutate: create, isPending: creating } = useCreateCalendarFeed({
    onSuccess: result => {
      setUrl(result.url);
      refresh();
    },
    onError: fail,
  });
  const { mutate: revoke, isPending: revoking } = useDeleteCalendarFeed({
    onSuccess: () => {
      setUrl(null);
      refresh();
    },
    onError: fail,
  });

  if (!data) return null;

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-base font-semibold">{t('title')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('hint')}</p>
      {url && (
        <div className="mt-4 space-y-2">
          <TextInput
            readOnly
            aria-label={t('address')}
            value={url}
            onFocus={event => event.currentTarget.select()}
          />
          <p className="text-xs text-muted-foreground">{t('once')}</p>
          <CopyButton value={url}>
            {({ copied, copy }) => (
              <Button size="xs" variant="default" onClick={copy}>
                {copied ? t('copied') : t('copy')}
              </Button>
            )}
          </CopyButton>
        </div>
      )}
      {data.enabled && !url && (
        <p className="mt-3 text-xs text-muted-foreground">
          {data.last_fetched_at
            ? t('last_read', { when: formatDateTime(data.last_fetched_at) })
            : t('never_read')}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          size="xs"
          color="brand"
          loading={creating}
          onClick={() => create()}
        >
          {data.enabled ? t('replace') : t('enable')}
        </Button>
        {data.enabled && (
          <Button
            size="xs"
            variant="subtle"
            color="red"
            loading={revoking}
            onClick={() => revoke()}
          >
            {t('revoke')}
          </Button>
        )}
      </div>
      {data.enabled && (
        <p className="mt-2 text-xs text-muted-foreground">
          {t('replace_hint')}
        </p>
      )}
    </Card>
  );
}
