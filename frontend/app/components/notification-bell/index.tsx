import { ActionIcon, Button, Indicator, Popover } from '@mantine/core';
import { IconBell } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import {
  getNotificationsKey,
  useGetNotifications,
} from '@internal/core/actions/get-notifications/get-notifications.hook';
import type { AppNotification } from '@internal/core/actions/get-notifications/get-notifications.types';
import { useReadNotification } from '@internal/core/actions/read-notification/read-notification.hook';
import { useReadAllNotifications } from '@internal/core/actions/read-all-notifications/read-all-notifications.hook';
import { formatNumber, formatRelative } from '../../i18n/format';

export function NotificationBell() {
  const { t } = useTranslation('notifications');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [opened, setOpened] = useState(false);
  const { data } = useGetNotifications();
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: getNotificationsKey });
  const { mutate: readOne } = useReadNotification({ onSuccess: refresh });
  const { mutate: readAll, isPending } = useReadAllNotifications({
    onSuccess: refresh,
  });

  if (!data) return null;

  const unread = data.unread_count;

  const open = (item: AppNotification) => {
    if (!item.read_at) readOne(item.id);
    setOpened(false);
    if (item.payload.form_id) {
      navigate(`/app/forms/${item.payload.form_id}/responses`);
    }
  };

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      width={340}
      position="bottom-end"
      shadow="md"
      withinPortal
    >
      <Popover.Target>
        <Indicator
          label={unread > 9 ? '9+' : formatNumber(unread)}
          disabled={unread === 0}
          size={16}
          color="red"
          offset={4}
        >
          <ActionIcon
            variant="subtle"
            color="gray"
            size="lg"
            aria-label={
              unread > 0
                ? t('bell_unread', { n: formatNumber(unread) })
                : t('bell_label')
            }
            onClick={() => setOpened(value => !value)}
          >
            <IconBell size={18} stroke={1.8} />
          </ActionIcon>
        </Indicator>
      </Popover.Target>
      <Popover.Dropdown p={0}>
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
          <p className="text-sm font-semibold">{t('title')}</p>
          <Button
            variant="subtle"
            size="compact-xs"
            disabled={unread === 0}
            loading={isPending}
            onClick={() => readAll()}
          >
            {t('mark_all')}
          </Button>
        </div>
        {data.notifications.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            {t('empty')}
          </p>
        ) : (
          <ul className="max-h-96 overflow-y-auto">
            {data.notifications.map(item => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => open(item)}
                  className="flex w-full items-start gap-3 border-b border-border px-3 py-2.5 text-left last:border-b-0 hover:bg-muted/50"
                >
                  <span
                    aria-hidden="true"
                    className={`mt-1.5 size-2 shrink-0 rounded-full ${item.read_at ? 'bg-transparent' : 'bg-primary'}`}
                  />
                  <span className="min-w-0">
                    <span
                      className={`block text-sm ${item.read_at ? 'text-muted-foreground' : 'font-semibold text-foreground'}`}
                    >
                      {item.kind === 'appointment_created'
                        ? t('kind_appointment_created')
                        : item.kind === 'appointment_requested'
                          ? t('kind_appointment_requested')
                          : item.kind === 'appointment_cancelled'
                            ? t('kind_appointment_cancelled')
                            : t('kind_unknown')}
                      {item.payload.sessions ? (
                        <span className="font-normal text-muted-foreground">
                          {' · '}
                          {t('sessions', { count: item.payload.sessions })}
                        </span>
                      ) : null}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {formatRelative(item.created_at)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Popover.Dropdown>
    </Popover>
  );
}
