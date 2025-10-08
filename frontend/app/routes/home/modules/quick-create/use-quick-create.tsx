import { useCreateShortlink } from '@internal/core/actions/create-shortlink/create-shortlink.hook';
import { notifications } from '@mantine/notifications';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { z } from 'zod/v4';
import { useNavigate } from 'react-router';
import { queryClient } from '@internal/core/service-provider';
import { getShortlinksKey } from '@internal/core/actions/get-shortlinks/get-shortlinks.hook';

const schema = z.object({
  title: z.string().optional(),
  original_url: z.url('Invalid URL'),
});

export function useQuickCreate() {
  const navigate = useNavigate();
  const form = useForm({
    mode: 'uncontrolled',
    initialValues: {
      title: '',
      original_url: '',
    },

    validate: zod4Resolver(schema),
  });
  const { mutate, isPending } = useCreateShortlink({
    onSuccess: data => {
      navigate(`/links/${data.id}`);
      queryClient.invalidateQueries({ queryKey: getShortlinksKey });
    },
    onError: error => {
      notifications.show({
        title: 'Error',
        message:
          error.message || 'Something went wrong, please try again later.',
        color: 'red',
      });
    },
  });

  function handleSubmit(values: typeof form.values) {
    mutate(values);
  }

  return { handleSubmit, form, loading: isPending };
}
