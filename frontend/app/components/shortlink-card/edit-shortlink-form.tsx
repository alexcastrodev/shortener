import { Button, Stack, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { z } from 'zod/v4';
import { IconLink } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { useTranslation } from 'react-i18next';
import type { Shortlink } from 'packages/core/types/Shortlink';
import { useUpdateShortlink } from 'packages/core/actions/update-shortlink/update-shortlink.hook';
import { queryClient } from 'packages/core/service-provider';
import { getShortlinksKey } from 'packages/core/actions/get-shortlinks/get-shortlinks.hook';

const schema = z.object({
  title: z.string().optional(),
  original_url: z.url('Invalid URL'),
});

interface EditShortlinkFormProps {
  shortlink: Shortlink;
  modalId: string;
}

export function EditShortlinkForm({
  shortlink,
  modalId,
}: EditShortlinkFormProps) {
  const { t } = useTranslation('dashboard');
  const form = useForm({
    mode: 'uncontrolled',
    initialValues: {
      title: shortlink.title ?? '',
      original_url: shortlink.original_url,
    },
    validate: zod4Resolver(schema),
  });

  const { mutate, isPending } = useUpdateShortlink(
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getShortlinksKey });
        notifications.show({
          message: t('shortlink_updated'),
          color: 'green',
        });
        modals.close(modalId);
      },
      onError: error => {
        notifications.show({
          title: t('error_title'),
          message: error.error || t('error_message'),
          color: 'red',
        });
      },
    },
    // Mantine modals render through a portal mounted above the
    // QueryClientProvider, so the client must be passed explicitly.
    queryClient
  );

  function handleSubmit(values: typeof form.values) {
    mutate({ id: shortlink.id, data: values });
  }

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <Stack gap="md">
        <TextInput
          label={t('enter_url_placeholder')}
          leftSection={<IconLink size={16} />}
          key={form.key('original_url')}
          {...form.getInputProps('original_url')}
          required
        />
        <TextInput
          label={t('title_placeholder')}
          key={form.key('title')}
          {...form.getInputProps('title')}
        />
        <Button type="submit" fullWidth loading={isPending} color="brand">
          {t('save_button')}
        </Button>
      </Stack>
    </form>
  );
}
