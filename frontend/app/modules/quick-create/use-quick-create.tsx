import { useCreateShortlink } from '@internal/core/actions/create-shortlink/create-shortlink.hook';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { z } from 'zod/v4';
import { useTranslation } from 'react-i18next';
import { queryClient } from '@internal/core/service-provider';
import { notifySuccess, notifyError } from '@internal/core/utils/notify';

export function useQuickCreate() {
  const { t } = useTranslation('dashboard');
  const schema = z.object({
    title: z.string().optional(),
    original_url: z.url(t('invalid_url')),
  });
  const form = useForm({
    mode: 'uncontrolled',
    initialValues: {
      title: '',
      original_url: '',
    },

    validate: zod4Resolver(schema),
  });
  const { mutate, isPending } = useCreateShortlink({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['get-shortlinks'] });
      form.reset();
      notifySuccess(t('link_created'));
    },
    onError: error => {
      notifyError(error.error || t('error_message'));
    },
  });

  function handleSubmit(values: typeof form.values) {
    mutate(values);
  }

  return { handleSubmit, form, loading: isPending };
}
