import { useCreateShortlink } from '@internal/core/actions/create-shortlink/create-shortlink.hook';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { z } from 'zod/v4';
import { queryClient } from '@internal/core/service-provider';
import { notifySuccess, notifyError } from '@internal/core/utils/notify';

const schema = z.object({
  title: z.string().optional(),
  original_url: z.url('Invalid URL'),
});

export function useQuickCreate() {
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
      notifySuccess('Link created successfully');
    },
    onError: error => {
      notifyError(error.error || 'Something went wrong, please try again later.');
    },
  });

  function handleSubmit(values: typeof form.values) {
    mutate(values);
  }

  return { handleSubmit, form, loading: isPending };
}
