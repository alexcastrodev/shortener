import { TextInput, Button } from '@mantine/core';
import { useQuickCreate } from './use-quick-create';
import { IconLink, IconPlus } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';

export function QuickCreate() {
  const { form, handleSubmit, loading } = useQuickCreate();
  const { t } = useTranslation('dashboard');

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <IconPlus size={18} className="text-blue-600 dark:text-blue-400" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {t('quick_create_title')}
        </h3>
      </div>

      <form onSubmit={form.onSubmit(handleSubmit)} className="space-y-3">
        <TextInput
          placeholder={t('enter_url_placeholder')}
          key={form.key('original_url')}
          {...form.getInputProps('original_url')}
          leftSection={<IconLink size={16} />}
          size="sm"
        />

        <TextInput
          placeholder={t('title_placeholder')}
          key={form.key('title')}
          {...form.getInputProps('title')}
          size="sm"
        />

        <Button
          type="submit"
          color="blue"
          fullWidth
          loading={loading}
          size="sm"
        >
          {t('create_button')}
        </Button>
      </form>
    </div>
  );
}

export default QuickCreate;
