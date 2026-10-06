import { Button, Switch } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@internal/ui';
import {
  getNotificationPreferencesKey,
  useGetNotificationPreferences,
} from '@internal/core/actions/get-notification-preferences/get-notification-preferences.hook';
import type { NoticeChannel } from '@internal/core/actions/get-notification-preferences/get-notification-preferences.types';
import { useUpdateNotificationPreferences } from '@internal/core/actions/update-notification-preferences/update-notification-preferences.hook';
import { useGetPushConfig } from '@internal/core/actions/get-push-config/get-push-config.hook';
import { cell, change, eventsOf, shownChannels } from './notice-matrix.ts';
import { disableDevice, enableDevice, readDeviceState } from './push.ts';
import type { DeviceState } from './push-logic.ts';

export function NoticeSettings() {
  const { t } = useTranslation('notices');
  const queryClient = useQueryClient();
  const { data } = useGetNotificationPreferences(true);
  const { data: pushConfig } = useGetPushConfig(true);
  const [device, setDevice] = useState<DeviceState | null>(null);
  const [busy, setBusy] = useState(false);
  const pushAvailable = pushConfig?.enabled === true;
  const channels = shownChannels(pushAvailable);

  useEffect(() => {
    if (pushConfig)
      readDeviceState(pushConfig.enabled).then(setDevice, () =>
        setDevice('unsupported')
      );
  }, [pushConfig]);

  const toggleDevice = async () => {
    if (!pushConfig?.public_key) return;
    setBusy(true);
    try {
      setDevice(
        device === 'on'
          ? await disableDevice()
          : await enableDevice(pushConfig.public_key)
      );
    } catch {
      notifications.show({ message: t('device_error'), color: 'red' });
    } finally {
      setBusy(false);
    }
  };
  const { mutate, isPending } = useUpdateNotificationPreferences({
    onSuccess: updated =>
      queryClient.setQueryData(getNotificationPreferencesKey, updated),
    onError: () => {
      notifications.show({ message: t('error'), color: 'red' });
      queryClient.invalidateQueries({
        queryKey: getNotificationPreferencesKey,
      });
    },
  });

  if (!data) return null;

  const eventLabel = (kind: string) => {
    switch (kind) {
      case 'appointment_created':
        return t('event_appointment_created');
      case 'appointment_requested':
        return t('event_appointment_requested');
      case 'appointment_cancelled':
        return t('event_appointment_cancelled');
      case 'appointment_expired':
        return t('event_appointment_expired');
      case 'appointment_auto_confirmed':
        return t('event_appointment_auto_confirmed');
      default:
        return t('event_unknown');
    }
  };
  const channelLabel = (channel: NoticeChannel) => {
    switch (channel) {
      case 'email':
        return t('channel_email');
      case 'push':
        return t('channel_push');
      default:
        return t('channel_in_app');
    }
  };
  const deviceText = () => {
    switch (device) {
      case 'on':
        return t('device_on');
      case 'ios_install':
        return t('device_ios');
      case 'unsupported':
        return t('device_unsupported');
      case 'denied':
        return t('device_denied');
      case 'server_off':
        return t('device_server_off');
      default:
        return t('device_off');
    }
  };

  return (
    <Card className="p-5 sm:p-6">
      <p className="font-semibold text-foreground">{t('title')}</p>
      <p className="mt-1 text-sm text-muted-foreground">{t('hint')}</p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th scope="col" className="py-2 pr-4 font-medium">
                {t('event')}
              </th>
              {channels.map(channel => (
                <th
                  key={channel}
                  scope="col"
                  className="px-3 py-2 text-center font-medium"
                >
                  {channelLabel(channel)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {eventsOf(data.preferences).map(kind => (
              <tr key={kind} className="border-t border-border">
                <th scope="row" className="py-3 pr-4 text-left font-normal">
                  {eventLabel(kind)}
                </th>
                {channels.map(channel => {
                  const item = cell(data.preferences, kind, channel);
                  return (
                    <td key={channel} className="px-3 py-3 text-center">
                      {item?.supported ? (
                        <Switch
                          aria-label={`${eventLabel(kind)}: ${channelLabel(channel)}`}
                          checked={item.enabled}
                          disabled={isPending}
                          onChange={event =>
                            mutate(
                              change(kind, channel, event.currentTarget.checked)
                            )
                          }
                        />
                      ) : (
                        <span
                          aria-label={t('not_available')}
                          className="text-muted-foreground"
                        >
                          —
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{t('footnote')}</p>
      {pushAvailable && device && (
        <div className="mt-5 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium">{t('device_title')}</p>
            <p className="text-xs text-muted-foreground">{deviceText()}</p>
          </div>
          {(device === 'on' || device === 'off') && (
            <Button
              variant="default"
              size="xs"
              loading={busy}
              onClick={toggleDevice}
            >
              {device === 'on' ? t('device_disable') : t('device_enable')}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
