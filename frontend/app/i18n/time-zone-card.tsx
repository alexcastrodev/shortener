import { NativeSelect } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Card } from '@internal/ui';
import { useUpdateProfile } from '@internal/core/actions/update-profile/update-profile.hook';
import { useUserState } from '@internal/core/states/use-user-state';
import { DEFAULT_TIME_ZONE, timeZoneOptions } from './time-zones';

export function TimeZoneCard({ zone }: { zone?: string }) {
  const { t } = useTranslation('settings');
  const queryClient = useQueryClient();
  const setUser = useUserState(state => state.setUser);
  const current = zone ?? DEFAULT_TIME_ZONE;
  const update = useUpdateProfile({
    onSuccess: saved => {
      setUser(saved);
      queryClient.invalidateQueries();
      notifications.show({ message: t('time_zone_saved'), color: 'green' });
    },
    onError: () =>
      notifications.show({ message: t('time_zone_failed'), color: 'red' }),
  });

  return (
    <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="min-w-0">
        <p className="font-semibold text-foreground">{t('time_zone')}</p>
        <p className="text-sm text-muted-foreground">{t('time_zone_hint')}</p>
      </div>
      <NativeSelect
        aria-label={t('time_zone')}
        size="sm"
        w={260}
        value={current}
        disabled={update.isPending}
        data={timeZoneOptions(current)}
        onChange={event =>
          update.mutate({ time_zone: event.currentTarget.value })
        }
      />
    </Card>
  );
}
