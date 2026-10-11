import { Button, Group, Stack, TextInput } from '@mantine/core';
import { useForm, type FormErrors } from '@mantine/form';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconPlus } from '@tabler/icons-react';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FormField, FormFieldInput } from '@internal/core/types/Form';
import { CategoriesSection } from './categories-section';
import { ExceptionsSection } from './exceptions-section';
import { RulesSection } from './rules-section';
import { ScheduleFields } from './schedule-fields';
import { ServiceCard } from './service-card';
import {
  DAYS,
  blankLesson,
  blankService,
  bookingSchema,
  initialValues,
  modeFor,
  scheduleSummary,
  toBookingInput,
  type Values,
} from '@internal/booking';
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
  const individual = field?.mode === 'individual';

  const schema = useMemo(
    () => bookingSchema(modeFor(field?.mode).validation, t),
    [t, field?.mode]
  );

  const form = useForm<Values>({
    mode: 'controlled',
    initialValues: initialValues(field),
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
      input: toBookingInput(form.values, false),
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

  const dayLabels: Record<(typeof DAYS)[number], string> = {
    mon: t('day_mon'),
    tue: t('day_tue'),
    wed: t('day_wed'),
    thu: t('day_thu'),
    fri: t('day_fri'),
    sat: t('day_sat'),
    sun: t('day_sun'),
  };

  const addService = () => {
    const service = individual
      ? blankLesson(t('lesson_new'))
      : blankService(
          t('service_new'),
          form.getValues().categories[0]?.id ?? ''
        );
    form.insertListItem('services', service);
    expand([service.key]);
  };

  const confirmRemove = (key: string) => {
    const service = form.getValues().services.find(item => item.key === key);
    if (!service) return;
    const name = service.name || t(individual ? 'lesson_new' : 'service_new');
    modals.openConfirmModal({
      title: t(individual ? 'lesson_remove_title' : 'service_remove_title'),
      centered: true,
      children: (
        <p className="text-sm">
          {t(individual ? 'lesson_remove_body' : 'service_remove_body')}
        </p>
      ),
      labels: {
        confirm: t('service_remove_confirm'),
        cancel: t('service_remove_cancel'),
      },
      confirmProps: {
        color: 'red',
        'aria-label': t(individual ? 'lesson_remove' : 'service_remove', {
          name,
        }),
      },
      onConfirm: () => {
        const index = form
          .getValues()
          .services.findIndex(item => item.key === key);
        if (index >= 0) form.removeListItem('services', index);
      },
    });
  };

  const { services, availability } = form.values;
  const availabilitySummary = scheduleSummary(availability, {
    times: count => t('summary_times', { count }),
    ownTimes: days => t('summary_own_times', { days }),
    day: day => dayLabels[day],
  });

  return (
    <form
      onSubmit={form.onSubmit(
        values => onSubmit(toBookingInput(values, creating)),
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
            required
            data-autofocus
            {...form.getInputProps('label')}
          />
          <TextInput label={t('help_label')} {...form.getInputProps('help')} />
        </Stack>

        {individual && (
          <section
            aria-labelledby="booking-availability-title"
            className="flex flex-col gap-4 border-t border-border pt-6"
          >
            <div>
              <h3
                id="booking-availability-title"
                className="text-sm font-medium"
              >
                {t('availability_title')}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t('availability_hint')}
              </p>
              <p className="break-words text-xs text-muted-foreground">
                {availabilitySummary}
              </p>
            </div>
            <ScheduleFields
              form={form}
              path="availability"
              duration={Number(services[0]?.duration) || 60}
              dayLabels={dayLabels}
            />
          </section>
        )}

        <section
          aria-labelledby="booking-services-title"
          className="flex flex-col gap-4 border-t border-border pt-6"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h3 id="booking-services-title" className="text-sm font-medium">
              {t(individual ? 'lessons_title' : 'services_title')}
            </h3>
            <span className="text-xs text-muted-foreground">
              {individual
                ? t('lesson_count', { count: services.length })
                : t('category_count', { count: services.length })}
            </span>
          </div>
          {!individual && <CategoriesSection form={form} />}
          {services.length === 0 && (
            <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              {t(individual ? 'no_lessons' : 'no_services')}
            </p>
          )}
          {services.map((service, index) => (
            <ServiceCard
              key={service.key}
              form={form}
              index={index}
              dayLabels={dayLabels}
              expanded={expanded.has(service.key)}
              onToggle={() => toggle(service.key)}
              onRemove={() => confirmRemove(service.key)}
            />
          ))}
          <Button
            variant="default"
            fullWidth
            style={{ borderStyle: 'dashed' }}
            leftSection={<IconPlus size={14} />}
            onClick={addService}
          >
            {t(individual ? 'lesson_add' : 'service_add')}
          </Button>
        </section>

        <ExceptionsSection form={form} />

        <RulesSection form={form} timeZone={field?.rules?.time_zone} />

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
