import { IconLink } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { Card, IconBadge } from '@internal/ui';

interface TotalLinksCardProps {
  total: number;
  isLoading: boolean;
}

export function TotalLinksCard({ total, isLoading }: TotalLinksCardProps) {
  const { t } = useTranslation('dashboard');

  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <IconBadge icon={<IconLink size={20} />} />
        <div className="flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('total_links')}
          </p>
          <p className="mt-0.5 text-2xl font-bold text-foreground">
            {isLoading ? '...' : total}
          </p>
        </div>
      </div>
    </Card>
  );
}
