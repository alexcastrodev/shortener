import { useTranslation } from 'react-i18next';
import type { DurationWords } from './booking-options.ts';

export function useDurationWords(): DurationWords {
  const { t } = useTranslation('respond');
  return {
    minutes: count => t('booking_minutes', { count }),
    hours: count => t('booking_hours', { count }),
    hoursMinutes: (hours, minutes) =>
      t('booking_hours_minutes', { hours, minutes }),
  };
}
