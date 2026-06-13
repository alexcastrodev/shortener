import { IconLink } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

export function DashboardHeader() {
  const { t } = useTranslation('dashboard');

  return (
    <div className="mb-8 flex items-center gap-3 border-b border-border pb-4">
      <div className="rounded-md bg-accent p-2.5 text-accent-foreground">
        <IconLink size={28} />
      </div>
      <div>
        <h1 className="text-3xl font-semibold text-foreground">
          {t('title')}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {t('subtitle')}
        </p>
      </div>
    </div>
  );
}
