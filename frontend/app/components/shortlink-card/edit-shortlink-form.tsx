import { Button, Checkbox, PasswordInput, Stack, TextInput } from '@mantine/core';
import { useForm } from '@mantine/form';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { z } from 'zod/v4';
import { IconCalendarTime, IconLink, IconLock } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { modals } from '@mantine/modals';
import { useTranslation } from 'react-i18next';
import type { Shortlink } from 'packages/core/types/Shortlink';
import { useUpdateShortlink } from 'packages/core/actions/update-shortlink/update-shortlink.hook';
import type { UpdateShortlinkRequestBody } from 'packages/core/actions/update-shortlink/update-shortlink.types';
import { queryClient } from 'packages/core/service-provider';
import {
  dateTimeLocalToIso,
  isFutureDateTimeLocal,
  isoToDateTimeLocal,
} from '../../utils/datetime-local';

const schema = z
  .object({
    title: z.string().optional(),
    original_url: z.url('Invalid URL'),
    password: z.string(),
    remove_password: z.boolean(),
    expires_at: z.string(),
  })
  .refine(values => values.password === '' || values.password.length >= 4, {
    path: ['password'],
    message: 'At least 4 characters',
  })
  .refine(values => values.password.length <= 72, {
    path: ['password'],
    message: 'At most 72 characters',
  })
  .refine(values => isFutureDateTimeLocal(values.expires_at), {
    path: ['expires_at'],
    message: 'Must be in the future',
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
    mode: 'controlled',
    initialValues: {
      title: shortlink.title ?? '',
      original_url: shortlink.original_url,
      password: '',
      remove_password: false,
      expires_at: isoToDateTimeLocal(shortlink.expires_at),
    },
    validate: zod4Resolver(schema),
  });

  const { mutate, isPending } = useUpdateShortlink(
    {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['get-shortlinks'] });
        queryClient.invalidateQueries({ queryKey: ['shortlink'] });
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
    const data: UpdateShortlinkRequestBody = {
      title: values.title,
      original_url: values.original_url,
      expires_at: dateTimeLocalToIso(values.expires_at),
    };
    // Only send the password when it changes: an omitted key keeps it.
    if (values.remove_password) data.password = null;
    else if (values.password) data.password = values.password;

    mutate({ id: shortlink.id, data });
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
        <PasswordInput
          label={t('password_label')}
          description={
            shortlink.password_protected
              ? t('password_keep_hint')
              : t('password_new_hint')
          }
          leftSection={<IconLock size={16} />}
          autoComplete="new-password"
          disabled={form.values.remove_password}
          key={form.key('password')}
          {...form.getInputProps('password')}
        />
        {shortlink.password_protected && (
          <Checkbox
            label={t('password_remove')}
            key={form.key('remove_password')}
            {...form.getInputProps('remove_password', { type: 'checkbox' })}
          />
        )}
        <TextInput
          type="datetime-local"
          label={t('expires_at_label')}
          description={t('expires_at_hint')}
          leftSection={<IconCalendarTime size={16} />}
          key={form.key('expires_at')}
          {...form.getInputProps('expires_at')}
        />
        <Button type="submit" fullWidth loading={isPending} color="brand">
          {t('save_button')}
        </Button>
      </Stack>
    </form>
  );
}
