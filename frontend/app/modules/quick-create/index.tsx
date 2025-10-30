import { TextInput, Button } from '@mantine/core';
import { useQuickCreate } from './use-quick-create';
import { IconLink, IconPlus } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { Card } from '@internal/ui';

export function QuickCreate() {
  const { form, handleSubmit, loading } = useQuickCreate();
  const { t } = useTranslation('dashboard');

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <IconPlus size={18} className="text-violet-400" />
        <h3 className="text-sm font-semibold text-white">
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
          fullWidth
          loading={loading}
          size="sm"
          color="violet"
        >
          {t('create_button')}
        </Button>
      </form>
    </Card>
  );
}

export default QuickCreate;
