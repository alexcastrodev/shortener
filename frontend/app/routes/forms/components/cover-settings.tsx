import { Button, Group, Slider, Stack, Switch, TextInput } from '@mantine/core';
import type { UseFormReturnType } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconPhoto, IconTrash } from '@tabler/icons-react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useDeleteFormCover } from '@internal/core/actions/delete-form-cover/delete-form-cover.hook';
import { useUploadFormCover } from '@internal/core/actions/upload-form-cover/upload-form-cover.hook';
import { formErrorMessage } from '../../../modules/forms/form-errors';

type Values = {
  cover_position: number;
  intro_enabled: boolean;
  start_label: string;
};

const TYPES = 'image/png,image/jpeg,image/webp';

export function CoverSettings({
  formId,
  hasCover,
  coverUrl,
  form,
  onChanged,
}: {
  formId: number;
  hasCover: boolean;
  coverUrl: string | null;
  form: UseFormReturnType<Values & Record<string, unknown>>;
  onChanged: () => void;
}) {
  const { t } = useTranslation('cover');
  const input = useRef<HTMLInputElement>(null);
  const fail = (error: unknown) =>
    notifications.show({
      title: t('error'),
      message:
        (error as { message?: string } | undefined)?.message ??
        formErrorMessage(error),
      color: 'red',
    });
  const { mutate: upload, isPending: uploading } = useUploadFormCover({
    onSuccess: onChanged,
    onError: fail,
  });
  const { mutate: remove, isPending: removing } = useDeleteFormCover({
    onSuccess: onChanged,
    onError: fail,
  });

  return (
    <Stack gap="sm">
      <div>
        <p className="text-sm font-medium">{t('title')}</p>
        <p className="text-xs text-muted-foreground">{t('hint')}</p>
      </div>
      {hasCover && coverUrl && (
        <img
          src={coverUrl}
          alt={t('preview_alt')}
          className="h-32 w-full rounded-lg border border-border object-cover"
          style={{ objectPosition: `50% ${form.values.cover_position}%` }}
        />
      )}
      <input
        ref={input}
        type="file"
        accept={TYPES}
        className="hidden"
        aria-label={t('choose')}
        onChange={event => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) upload({ id: formId, file });
        }}
      />
      <Group gap="xs">
        <Button
          variant="default"
          size="xs"
          leftSection={<IconPhoto size={14} />}
          loading={uploading}
          onClick={() => input.current?.click()}
        >
          {hasCover ? t('replace') : t('choose')}
        </Button>
        {hasCover && (
          <Button
            variant="subtle"
            color="red"
            size="xs"
            leftSection={<IconTrash size={14} />}
            loading={removing}
            onClick={() => remove(formId)}
          >
            {t('remove')}
          </Button>
        )}
      </Group>
      <p className="text-xs text-muted-foreground">{t('limits')}</p>
      {hasCover && (
        <div>
          <p className="mb-1 text-sm">{t('position')}</p>
          <Slider
            min={0}
            max={100}
            label={value => `${value}%`}
            aria-label={t('position')}
            value={form.values.cover_position}
            onChange={value => form.setFieldValue('cover_position', value)}
          />
        </div>
      )}
      <Switch
        label={t('intro')}
        description={t('intro_hint')}
        checked={form.values.intro_enabled}
        onChange={event =>
          form.setFieldValue('intro_enabled', event.currentTarget.checked)
        }
      />
      <TextInput
        label={t('start_label')}
        description={t('start_label_hint')}
        maxLength={40}
        placeholder={t('start_placeholder')}
        {...form.getInputProps('start_label')}
      />
    </Stack>
  );
}
