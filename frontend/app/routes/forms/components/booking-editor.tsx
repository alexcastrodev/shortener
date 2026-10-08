import { Button, Group, Stack, TextInput } from '@mantine/core';
import { useForm, type FormErrors } from '@mantine/form';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { IconPlus } from '@tabler/icons-react';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod/v4';
import type { FormField, FormFieldInput } from '@internal/core/types/Form';
import { CategoriesSection } from './categories-section';
import { ExceptionsSection } from './exceptions-section';
import { RulesSection } from './rules-section';
import { ServiceCard } from './service-card';
import { timeoutInRange } from '../../../modules/forms/duration-units.ts';
import {
  DAYS,
  TIME,
  blankService,
  initialValues,
  toBookingInput,
  type Values,
} from '../../../modules/forms/booking-config.ts';

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

  const schema = useMemo(
    () =>
      z
        .object({
          label: z.string().trim().min(1).max(300),
          help: z.string().max(500),
          approval: z.enum(['auto', 'manual']),
          approval_timeout_minutes: z.union([z.number(), z.literal('')]),
          waitlist: z.boolean(),
          waitlist_confirm_minutes: z.union([z.number(), z.literal('')]),
          approval_soon_only: z.boolean(),
          approval_within_minutes: z.union([z.number(), z.literal('')]),
          categories: z.array(
            z.object({
              name: z.string().trim().min(1, t('category_name_error')).max(60),
            })
          ),
          exceptionDraft: z.object({ from: z.string() }).loose(),
          exceptions: z.array(
            z
              .object({
                kind: z.enum(['closed', 'special']),
                from: z
                  .string()
                  .regex(/^\d{4}-\d{2}-\d{2}$/, t('err_exc_from')),
                to: z.string(),
                times: z.array(z.object({ value: z.string() })),
              })
              .check(ctx => {
                const { kind, from, to, times } = ctx.value;
                if (to && from && to < from) {
                  ctx.issues.push({
                    code: 'custom',
                    message: t('err_exc_range'),
                    path: ['to'],
                    input: to,
                  });
                }
                if (
                  kind === 'special' &&
                  !times.some(time => TIME.test(time.value))
                ) {
                  ctx.issues.push({
                    code: 'custom',
                    message: t('err_exc_times'),
                    path: ['times'],
                    input: times,
                  });
                }
              })
          ),
          services: z.array(
            z
              .object({
                name: z.string().trim().min(1, t('error_name')).max(100),
                duration: z
                  .number(t('error_duration'))
                  .int()
                  .min(5, t('error_duration'))
                  .max(600, t('error_duration')),
                price: z.union([z.number().min(0), z.literal('')]),
                currency: z.string(),
                days: z.array(z.string()).min(1, t('error_days')),
                times: z
                  .array(
                    z.object({ value: z.string().regex(TIME, t('error_time')) })
                  )
                  .min(1, t('error_times')),
                monthly: z.boolean(),
                monthlyPrice: z.union([z.number().min(0), z.literal('')]),
                bundle: z.boolean(),
                bundleTake: z.union([z.number(), z.literal('')]),
                bundlePay: z.union([z.number(), z.literal('')]),
                byDay: z.record(
                  z.string(),
                  z.array(
                    z.object({ value: z.string().regex(TIME, t('error_time')) })
                  )
                ),
              })
              .check(ctx => {
                const {
                  price,
                  currency,
                  monthly,
                  monthlyPrice,
                  bundle,
                  bundleTake,
                  bundlePay,
                } = ctx.value;
                if (bundle) {
                  if (price === '') {
                    ctx.issues.push({
                      code: 'custom',
                      message: t('error_bundle_price'),
                      path: ['price'],
                      input: price,
                    });
                  }
                  const valid =
                    bundleTake !== '' &&
                    bundlePay !== '' &&
                    Number.isInteger(bundleTake) &&
                    Number.isInteger(bundlePay) &&
                    bundleTake >= 2 &&
                    bundleTake <= 31 &&
                    bundlePay >= 1 &&
                    bundlePay < bundleTake;
                  if (!valid) {
                    ctx.issues.push({
                      code: 'custom',
                      message: t('error_bundle'),
                      path: ['bundlePay'],
                      input: bundlePay,
                    });
                  }
                }
                if (
                  monthly &&
                  monthlyPrice !== '' &&
                  !/^[A-Za-z]{3}$/.test(currency.trim())
                ) {
                  ctx.issues.push({
                    code: 'custom',
                    message: t('error_price_currency'),
                    path: ['currency'],
                    input: currency,
                  });
                }
                if (price !== '' && !/^[A-Za-z]{3}$/.test(currency.trim())) {
                  ctx.issues.push({
                    code: 'custom',
                    message: t('error_price_currency'),
                    path: ['currency'],
                    input: currency,
                  });
                }
              })
          ),
        })
        .check(ctx => {
          const {
            approval,
            approval_soon_only: soonOnly,
            approval_within_minutes: within,
            approval_timeout_minutes: minutes,
            waitlist,
            waitlist_confirm_minutes: confirm,
            exceptionDraft,
          } = ctx.value;
          if (exceptionDraft.from) {
            ctx.issues.push({
              code: 'custom',
              message: t('err_exc_pending'),
              path: ['exceptionDraft', 'from'],
              input: exceptionDraft.from,
            });
          }
          if (approval === 'manual' && soonOnly && !timeoutInRange(within)) {
            ctx.issues.push({
              code: 'custom',
              message: t('error_timeout'),
              path: ['approval_within_minutes'],
              input: within,
            });
          }
          if (waitlist && !timeoutInRange(confirm, 15, 4320)) {
            ctx.issues.push({
              code: 'custom',
              message: t('error_waitlist_timeout'),
              path: ['waitlist_confirm_minutes'],
              input: confirm,
            });
          }
          if (approval === 'manual' && !timeoutInRange(minutes)) {
            ctx.issues.push({
              code: 'custom',
              message: t('error_timeout'),
              path: ['approval_timeout_minutes'],
              input: minutes,
            });
          }
        }),
    [t]
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
    const service = blankService(
      t('service_new'),
      form.getValues().categories[0]?.id ?? ''
    );
    form.insertListItem('services', service);
    expand([service.key]);
  };

  const confirmRemove = (key: string) => {
    const service = form.getValues().services.find(item => item.key === key);
    if (!service) return;
    const name = service.name || t('service_new');
    modals.openConfirmModal({
      title: t('service_remove_title'),
      centered: true,
      children: <p className="text-sm">{t('service_remove_body')}</p>,
      labels: {
        confirm: t('service_remove_confirm'),
        cancel: t('service_remove_cancel'),
      },
      confirmProps: {
        color: 'red',
        'aria-label': t('service_remove', { name }),
      },
      onConfirm: () => {
        const index = form
          .getValues()
          .services.findIndex(item => item.key === key);
        if (index >= 0) form.removeListItem('services', index);
      },
    });
  };

  const { services } = form.values;

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

        <section
          aria-labelledby="booking-services-title"
          className="flex flex-col gap-4 border-t border-border pt-6"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h3 id="booking-services-title" className="text-sm font-medium">
              {t('services_title')}
            </h3>
            <span className="text-xs text-muted-foreground">
              {t('category_count', { count: services.length })}
            </span>
          </div>
          <CategoriesSection form={form} />
          {services.length === 0 && (
            <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              {t('no_services')}
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
            {t('service_add')}
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
