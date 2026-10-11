import { useTranslation } from 'react-i18next';
import type { BioTheme } from '../bio-page/themes';
import { ZoneSelect } from './view-zone.tsx';

export function PickHeading({ theme }: { theme: BioTheme }) {
  const { t } = useTranslation('respond');
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <p className="text-xl font-semibold">{t('booking_pick')}</p>
      <ZoneSelect theme={theme} />
    </div>
  );
}
