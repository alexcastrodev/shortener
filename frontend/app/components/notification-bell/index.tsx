import { ActionIcon, Indicator } from '@mantine/core';
import { IconBell } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router';
import { useGetNotifications } from '@internal/core/actions/get-notifications/get-notifications.hook';
import { formatNumber } from '../../i18n/format';

export function NotificationBell({
  withLabel = false,
}: {
  withLabel?: boolean;
}) {
  const { t } = useTranslation('notifications');
  const { data } = useGetNotifications();
  const unread = data?.unread_count ?? 0;
  const label =
    unread > 0
      ? t('bell_unread', { n: formatNumber(unread) })
      : t('bell_label');

  if (withLabel) {
    return (
      <NavLink
        to="/app/notifications"
        aria-label={label}
        className={({ isActive }) =>
          [
            'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
            isActive
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
          ].join(' ')
        }
      >
        <IconBell size={17} stroke={1.8} />
        <span className="flex-1">{t('title')}</span>
        {unread > 0 && (
          <span className="rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">
            {unread > 9 ? '9+' : formatNumber(unread)}
          </span>
        )}
      </NavLink>
    );
  }

  return (
    <Indicator
      label={unread > 9 ? '9+' : formatNumber(unread)}
      disabled={unread === 0}
      size={16}
      color="red"
      offset={4}
    >
      <ActionIcon
        component={NavLink}
        to="/app/notifications"
        variant="subtle"
        color="gray"
        size="lg"
        aria-label={label}
      >
        <IconBell size={18} stroke={1.8} />
      </ActionIcon>
    </Indicator>
  );
}
