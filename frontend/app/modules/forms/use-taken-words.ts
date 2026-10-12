import { useTranslation } from 'react-i18next';
import type { TakenWords } from './booking-refusal.ts';
import { dayLabel } from './session-picker.tsx';

export function useTakenWords(): TakenWords {
  const { t } = useTranslation('respond');
  return {
    plain: t('booking_taken'),
    service: service => t('booking_taken_service', { service }),
    serviceAt: (service, date, time) =>
      t('booking_taken_service_at', {
        service,
        when: t('booking_when', { date: dayLabel(date), time }),
      }),
  };
}
