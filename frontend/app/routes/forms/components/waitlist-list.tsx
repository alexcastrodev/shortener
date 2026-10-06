import { useTranslation } from 'react-i18next';
import { Card } from '@internal/ui';
import { useGetFormWaitlist } from '@internal/core/actions/waitlist/waitlist.hook';
import { formatDateTime } from '../../../i18n/format';

export function WaitlistList({
  formId,
  enabled,
  timeZone,
}: {
  formId: number | string;
  enabled: boolean;
  timeZone: string;
}) {
  const { t } = useTranslation('appointments');
  const { data } = useGetFormWaitlist(formId, enabled);

  if (!enabled || !data || data.length === 0) return null;

  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold">{t('waitlist_title')}</h3>
      <ul className="mt-2 divide-y divide-border text-sm">
        {data.map(row => (
          <li
            key={row.id}
            className="flex flex-wrap justify-between gap-2 py-2"
          >
            <span>
              <span className="font-medium">{row.name}</span>
              <span className="ml-2 text-muted-foreground">{row.email}</span>
            </span>
            <span className="text-muted-foreground">
              {formatDateTime(row.starts_at, {
                dateStyle: 'medium',
                timeStyle: 'short',
                timeZone,
              })}
              {' · '}
              {row.status === 'offered'
                ? t('waitlist_offered')
                : t('waitlist_waiting')}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
