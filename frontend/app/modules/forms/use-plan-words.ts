import { useTranslation } from 'react-i18next';
import type { Allowance } from './booking-options.ts';

export function usePlanWords() {
  const { t } = useTranslation('respond');
  return {
    counter: (allowance: Allowance, picked: number) =>
      allowance.per === 'week'
        ? t('plan_counter_week', { count: picked, limit: allowance.limit })
        : t('plan_counter_month', { picked, count: allowance.limit }),
    sessions: (count: number) => t('plan_sessions', { count }),
  };
}
