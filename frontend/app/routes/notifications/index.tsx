import { Button, Center, Loader } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import {
  getNotificationsKey,
  useGetNotifications,
} from '@internal/core/actions/get-notifications/get-notifications.hook';
import type { AppNotification } from '@internal/core/actions/get-notifications/get-notifications.types';
import { useReadNotification } from '@internal/core/actions/read-notification/read-notification.hook';
import { useReadAllNotifications } from '@internal/core/actions/read-all-notifications/read-all-notifications.hook';
import { PageContainer } from '@internal/ui';
import { formatDateTime, formatRelative } from '../../i18n/format';

export const ssr = false;

export function meta() {
  return [{ title: 'Notifications - Kurz' }];
}

export default function NotificationsPage() {
  const { t } = useTranslation('notifications');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading } = useGetNotifications();
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: getNotificationsKey });
  const { mutate: readOne } = useReadNotification({ onSuccess: refresh });
  const { mutate: readAll, isPending } = useReadAllNotifications({
    onSuccess: refresh,
  });

  const kindLabel = (item: AppNotification) => {
    if (item.recipient_kind === 'client') {
      switch (item.kind) {
        case 'appointment_confirmed':
          return t('client_kind_appointment_confirmed');
        case 'appointment_request_received':
          return t('client_kind_appointment_request_received');
        case 'appointment_declined':
          return t('client_kind_appointment_declined');
        case 'appointment_cancelled':
          return t('client_kind_appointment_cancelled');
        case 'appointment_reminder':
          return t('client_kind_appointment_reminder');
        case 'appointment_rescheduled':
          return t('client_kind_appointment_rescheduled');
        case 'waitlist_joined':
          return t('client_kind_waitlist_joined', {
            service: item.payload.service,
          });
        case 'waitlist_offered':
          return t('client_kind_waitlist_offered', {
            service: item.payload.service,
            when: item.payload.starts_at
              ? formatDateTime(item.payload.starts_at)
              : '',
          });
        default:
          return t('kind_unknown');
      }
    }
    switch (item.kind) {
      case 'appointment_created':
        return t('kind_appointment_created');
      case 'appointment_requested':
        return t('kind_appointment_requested');
      case 'appointment_cancelled':
        return t('kind_appointment_cancelled');
      case 'appointment_expired':
        return t('kind_appointment_expired');
      case 'appointment_auto_confirmed':
        return t('kind_appointment_auto_confirmed');
      default:
        return t('kind_unknown');
    }
  };

  if (isLoading || !data) {
    return (
      <Center py="xl">
        <Loader size="lg" color="brand" />
      </Center>
    );
  }

  const open = (item: AppNotification) => {
    if (!item.read_at) readOne(item.id);
    if (item.recipient_kind === 'client') {
      navigate(item.waitlist_path ?? '/app/agenda');
    } else if (item.payload.form_id) {
      navigate(`/app/forms/${item.payload.form_id}/responses`);
    }
  };

  return (
    <PageContainer className="pb-24 sm:pb-10">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <Button
          variant="subtle"
          size="compact-sm"
          disabled={data.unread_count === 0}
          loading={isPending}
          onClick={() => readAll()}
        >
          {t('mark_all')}
        </Button>
      </div>

      {data.notifications.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {t('empty')}
        </p>
      ) : (
        <ul className="overflow-hidden rounded-lg border border-border">
          {data.notifications.map(item => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => open(item)}
                className="flex w-full items-start gap-3 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-muted/50"
              >
                <span
                  aria-hidden="true"
                  className={`mt-1.5 size-2 shrink-0 rounded-full ${item.read_at ? 'bg-transparent' : 'bg-primary'}`}
                />
                <span className="min-w-0">
                  <span
                    className={`block text-sm ${item.read_at ? 'text-muted-foreground' : 'font-semibold text-foreground'}`}
                  >
                    {kindLabel(item)}
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
    </PageContainer>
  );
}
