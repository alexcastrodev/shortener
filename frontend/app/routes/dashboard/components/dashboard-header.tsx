import { IconLink } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

export function DashboardHeader() {
  const { t } = useTranslation('dashboard');

  return (
    <div className="flex items-center gap-3 mb-8 pb-4 border-b-2 border-blue-500 dark:border-blue-600">
      <div className="p-2.5 bg-blue-600 dark:bg-blue-500 rounded-xl shadow-lg">
        <IconLink size={28} className="text-white" />
      </div>
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          {t('title')}
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {t('subtitle')}
        </p>
      </div>
    </div>
  );
}
