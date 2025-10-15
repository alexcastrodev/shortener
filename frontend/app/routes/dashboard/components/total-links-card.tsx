import { IconLink } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

interface TotalLinksCardProps {
  total: number;
  isLoading: boolean;
}

export function TotalLinksCard({ total, isLoading }: TotalLinksCardProps) {
  const { t } = useTranslation('dashboard');

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <IconLink size={20} className="text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {t('total_links')}
          </p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-0.5">
            {isLoading ? '...' : total}
          </p>
        </div>
      </div>
    </div>
  );
}
