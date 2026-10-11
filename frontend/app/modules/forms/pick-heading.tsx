import { useTranslation } from 'react-i18next';

export function PickHeading({ zone }: { zone?: string }) {
  const { t } = useTranslation('respond');
  return (
    <div className="flex items-baseline justify-between gap-3">
      <p className="text-xl font-semibold">{t('booking_pick')}</p>
      {zone && (
        <p className="text-xs opacity-70">{t('booking_zone', { zone })}</p>
      )}
    </div>
  );
}
