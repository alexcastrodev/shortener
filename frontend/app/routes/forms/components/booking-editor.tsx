import { Button, Group, Stack, TextInput } from '@mantine/core';
import { useForm, type FormErrors } from '@mantine/form';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FormField, FormFieldInput } from '@internal/core/types/Form';
import { bookingSchema, type Values } from '@internal/booking';
import type { DayLabels } from './booking-modes/editor-mode';
import { editorFor } from './booking-modes/modes';
import { ExceptionsSection } from './exceptions-section';
import { RulesSection } from './rules-section';
import { useBookingDraft } from '../../../modules/forms/booking-draft.ts';

const SERVICE_ERROR = /^services\.(\d+)\./;

export function BookingEditor({
  field,
  loading,
  openService,
  onSubmit,
  onCancel,
}: {
  field?: FormField;
  loading: boolean;
  openService?: { id: string } | null;
  onSubmit: (input: FormFieldInput) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation('booking');
  const creating = !field;
  const editor = editorFor(field?.mode);

  const schema = useMemo(
    () => bookingSchema(editor.mode.validation, t),
    [t, editor]
  );

  const form = useForm<Values>({
    mode: 'controlled',
    initialValues: editor.mode.initialValues(field),
    validate: zod4Resolver(schema),
  });

  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const { services } = form.getValues();
    const wanted = services.find(item => item.id === openService?.id);
    const only = services.length === 1 ? services[0] : undefined;
    return new Set(
      [wanted?.key, only?.key].filter((key): key is string => Boolean(key))
    );
  });

  const publishDraft = useBookingDraft();

  useEffect(() => {
    if (!field) return;
    const openIndex = form.values.services.findIndex(item => expanded.has(item.key));
    publishDraft({
      fieldId: field.id,
      input: editor.mode.toBookingInput(form.values, false),
      openIndex,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.values, expanded]);

  useEffect(() => () => publishDraft(null), []);

  const expand = (keys: string[]) =>
    setExpanded(current => new Set([...current, ...keys]));

  const toggle = (key: string) =>
    setExpanded(current => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });

  useEffect(() => {
    if (!openService) return;
    const service = form
      .getValues()
      .services.find(item => item.id === openService.id);
    if (!service) return;
    expand([service.key]);
    requestAnimationFrame(() =>
      document
        .getElementById(`service-${service.key}`)
        ?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    );
  }, [openService]);

  const openInvalidServices = (errors: FormErrors) => {
    const { services } = form.getValues();
    expand(
      Object.keys(errors)
        .map(path => SERVICE_ERROR.exec(path)?.[1])
        .map(index =>
          index === undefined ? undefined : services[Number(index)]?.key
        )
        .filter((key): key is string => Boolean(key))
    );
    notifications.show({ message: t('fix_errors'), color: 'red' });
  };

  const dayLabels: DayLabels = {
    mon: t('day_mon'),
    tue: t('day_tue'),
    wed: t('day_wed'),
    thu: t('day_thu'),
    fri: t('day_fri'),
    sat: t('day_sat'),
    sun: t('day_sun'),
  };

  const words = editor.words(t);

  const addService = () => {
    const service = editor.mode.blankItem(form.getValues(), words.unnamed);
    form.insertListItem('services', service);
    expand([service.key]);
  };

  const confirmRemove = (key: string) => {
    const service = form.getValues().services.find(item => item.key === key);
    if (!service) return;
    modals.openConfirmModal({
      title: words.removeTitle,
      centered: true,
      children: <p className="text-sm">{words.removeBody}</p>,
      labels: {
        confirm: t('service_remove_confirm'),
        cancel: t('service_remove_cancel'),
      },
      confirmProps: {
        color: 'red',
        'aria-label': words.remove(service.name || words.unnamed),
      },
      onConfirm: () => {
        const index = form
          .getValues()
          .services.findIndex(item => item.key === key);
        if (index >= 0) form.removeListItem('services', index);
      },
    });
  };

  return (
    <form
      onSubmit={form.onSubmit(
        values => onSubmit(editor.mode.toBookingInput(values, creating)),
        openInvalidServices
      )}
    >
      <Stack gap="xl">
        <Stack gap="md">
          <p className="text-xs font-medium text-muted-foreground">
            {t('type_label')}
          </p>
          <TextInput
            label={t('question_label')}
            description={t('question_hint')}
            data-autofocus
            {...form.getInputProps('label')}
          />
          <TextInput label={t('help_label')} {...form.getInputProps('help')} />
        </Stack>

        <editor.Flow
          form={form}
          editor={editor}
          dayLabels={dayLabels}
          list={{
            expanded,
            toggle,
            add: addService,
            remove: confirmRemove,
          }}
        />

        <ExceptionsSection form={form} />

        <RulesSection
          form={form}
          editor={editor}
          timeZone={field?.rules?.time_zone}
        />

        <Group
          justify="flex-end"
          gap="sm"
          className="border-t border-border pt-6"
        >
          <Button variant="default" onClick={onCancel}>
            {t('cancel')}
          </Button>
          <Button type="submit" color="brand" loading={loading}>
            {creating ? t('add') : t('save')}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
