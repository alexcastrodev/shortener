import {
  ActionIcon,
  Button,
  Chip,
  Group,
  NumberInput,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  TextInput,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { modals } from '@mantine/modals';
import { IconPlus, IconTrash, IconX } from '@tabler/icons-react';
import { zod4Resolver } from 'mantine-form-zod-resolver';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod/v4';
import type { FormField, FormFieldInput } from '@internal/core/types/Form';
import { BundleOffer } from './bundle-offer';
import { CategoriesSection } from './categories-section';
import { ExceptionsSection } from './exceptions-section';
import { TimeGeneratorPanel } from './time-generator-panel';
import { TimeoutInput } from './timeout-input';
import { timeoutInRange } from '../../../modules/forms/duration-units.ts';
import { WeekdayTimes } from './weekday-times';
import {
  DAYS,
  REMINDERS_MAX,
  REMINDER_CHOICES,
  TIME,
  blankService,
  initialValues,
  isGrouped,
  newKey,
  toBookingInput,
  type ServiceValues,
  type Values,
} from '../../../modules/forms/booking-config.ts';

export function BookingEditor({
  field,
  loading,
  onSubmit,
  onCancel,
}: {
  field?: FormField;
  loading: boolean;
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
          approval_soon_only: z.boolean(),
          approval_within_minutes: z.union([z.number(), z.literal('')]),
          categories: z.array(
            z.object({
              name: z.string().trim().min(1, t('category_name_error')).max(60),
            })
          ),
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
                const { price, currency, bundle, bundleTake, bundlePay } =
                  ctx.value;
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
          const { approval, approval_timeout_minutes: minutes } = ctx.value;
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

  const reminderLabels: Record<(typeof REMINDER_CHOICES)[number], string> = {
    60: t('reminder_60'),
    120: t('reminder_120'),
    360: t('reminder_360'),
    1440: t('reminder_1440'),
    2880: t('reminder_2880'),
    10080: t('reminder_10080'),
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

  const confirmRemove = (index: number) => {
    const name = form.values.services[index].name || t('service_new');
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
      onConfirm: () => form.removeListItem('services', index),
    });
  };

  const renderService = (service: ServiceValues, index: number) => (
    <div key={service.key} className="rounded-lg border border-border p-3">
      <Stack gap="sm">
        <Group gap="xs" wrap="nowrap" align="flex-end">
          <TextInput
            className="flex-1"
            label={t('service_name')}
            {...form.getInputProps(`services.${index}.name`)}
          />
          <ActionIcon
            variant="subtle"
            color="red"
            size="lg"
            aria-label={t('service_remove', {
              name: service.name || t('service_new'),
            })}
            onClick={() => confirmRemove(index)}
          >
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
        {isGrouped(form.values) && (
          <Select
            label={t('service_move')}
            allowDeselect={false}
            data={form.values.categories.map(item => ({
              value: item.id,
              label: item.name || t('category_new'),
            }))}
            value={service.categoryId}
            onChange={value =>
              value && form.setFieldValue(`services.${index}.categoryId`, value)
            }
          />
        )}
        <Group grow align="flex-start">
          <NumberInput
            label={t('service_duration')}
            min={5}
            max={600}
            allowDecimal={false}
            {...form.getInputProps(`services.${index}.duration`)}
          />
          <NumberInput
            label={t('service_capacity')}
            description={t('service_capacity_hint')}
            min={1}
            max={1000}
            allowDecimal={false}
            {...form.getInputProps(`services.${index}.capacity`)}
          />
        </Group>
        <Group grow align="flex-start">
          <NumberInput
            label={t('service_price')}
            min={0}
            decimalScale={2}
            {...form.getInputProps(`services.${index}.price`)}
          />
          <TextInput
            label={t('service_currency')}
            maxLength={3}
            placeholder="EUR"
            {...form.getInputProps(`services.${index}.currency`)}
          />
        </Group>
        <div>
          <p className="mb-1 text-sm font-medium">{t('service_days')}</p>
          <Chip.Group
            multiple
            value={service.days}
            onChange={value =>
              form.setFieldValue(`services.${index}.days`, value)
            }
          >
            <Group gap={6}>
              {DAYS.map(day => (
                <Chip key={day} value={day} size="xs">
                  {dayLabels[day]}
                </Chip>
              ))}
            </Group>
          </Chip.Group>
          {typeof form.errors[`services.${index}.days`] === 'string' && (
            <p className="mt-1 text-xs text-red-500">
              {form.errors[`services.${index}.days`]}
            </p>
          )}
        </div>
        <div>
          <p className="mb-1 text-sm font-medium">{t('service_times')}</p>
          <Group gap="xs">
            {service.times.map((time, timeIndex) => (
              <Group key={time.key} gap={2} wrap="nowrap">
                <TextInput
                  type="time"
                  size="xs"
                  aria-label={t('service_times')}
                  {...form.getInputProps(
                    `services.${index}.times.${timeIndex}.value`
                  )}
                />
                <ActionIcon
                  variant="subtle"
                  color="gray"
                  aria-label={t('service_remove_time', {
                    time: time.value,
                  })}
                  onClick={() =>
                    form.removeListItem(`services.${index}.times`, timeIndex)
                  }
                >
                  <IconX size={14} />
                </ActionIcon>
              </Group>
            ))}
            <Button
              variant="subtle"
              size="compact-xs"
              leftSection={<IconPlus size={12} />}
              onClick={() =>
                form.insertListItem(`services.${index}.times`, {
                  key: newKey(),
                  value: '',
                })
              }
            >
              {t('service_add_time')}
            </Button>
          </Group>
          <div className="mt-2">
            <TimeGeneratorPanel
              duration={Number(service.duration) || 60}
              hasTimes={service.times.length > 0}
              onApply={times =>
                form.setFieldValue(
                  `services.${index}.times`,
                  times.map(value => ({ key: newKey(), value }))
                )
              }
            />
          </div>
          {typeof form.errors[`services.${index}.times`] === 'string' && (
            <p className="mt-1 text-xs text-red-500">
              {form.errors[`services.${index}.times`]}
            </p>
          )}
        </div>
        <BundleOffer form={form} index={index} />
        <WeekdayTimes form={form} index={index} dayLabels={dayLabels} />
      </Stack>
    </div>
  );

  return (
    <form
      onSubmit={form.onSubmit(values =>
        onSubmit(toBookingInput(values, creating))
      )}
    >
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

        <Stack gap="sm">
          <div>
            <p className="text-sm font-medium">{t('services_title')}</p>
            <p className="text-xs text-muted-foreground">
              {t('services_hint')}
            </p>
          </div>
          <CategoriesSection form={form} renderService={renderService} />
        </Stack>

        <ExceptionsSection form={form} />

        <Stack gap="sm">
          <p className="text-sm font-medium">{t('rules_title')}</p>
          {field?.rules?.time_zone && (
            <div>
              <p className="text-xs text-muted-foreground">{t('time_zone')}</p>
              <p className="text-sm">{field.rules.time_zone}</p>
              <p className="text-xs text-muted-foreground">
                {t('time_zone_hint')}
              </p>
            </div>
          )}
          <div>
            <p className="mb-1 text-sm">{t('approval')}</p>
            <SegmentedControl
              data={[
                { value: 'auto', label: t('approval_auto') },
                { value: 'manual', label: t('approval_manual') },
              ]}
              value={form.values.approval}
              onChange={value =>
                form.setFieldValue('approval', value as 'auto' | 'manual')
              }
            />
          </div>
          {form.values.approval === 'manual' && (
            <Stack gap="xs">
              <Switch
                label={t('approval_soon_only')}
                description={t('approval_soon_hint')}
                checked={form.values.approval_soon_only}
                onChange={event =>
                  form.setFieldValue(
                    'approval_soon_only',
                    event.currentTarget.checked
                  )
                }
              />
              {form.values.approval_soon_only && (
                <TimeoutInput
                  label={t('approval_within')}
                  minutes={form.values.approval_within_minutes}
                  error={
                    form.errors.approval_within_minutes as string | undefined
                  }
                  onChange={value =>
                    form.setFieldValue('approval_within_minutes', value)
                  }
                />
              )}
            </Stack>
          )}
          {form.values.approval === 'manual' && (
            <Group grow align="flex-start">
              <TimeoutInput
                minutes={form.values.approval_timeout_minutes}
                error={
                  form.errors.approval_timeout_minutes as string | undefined
                }
                onChange={value =>
                  form.setFieldValue('approval_timeout_minutes', value)
                }
              />
              <div>
                <p className="mb-1 text-sm">{t('approval_on_timeout')}</p>
                <SegmentedControl
                  data={[
                    { value: 'decline', label: t('on_timeout_decline') },
                    { value: 'accept', label: t('on_timeout_accept') },
                  ]}
                  value={form.values.approval_on_timeout}
                  onChange={value =>
                    form.setFieldValue(
                      'approval_on_timeout',
                      value as 'decline' | 'accept'
                    )
                  }
                />
              </div>
            </Group>
          )}
          <div>
            <p className="mb-1 text-sm">{t('reminders')}</p>
            <Chip.Group
              multiple
              value={form.values.reminder_minutes.map(String)}
              onChange={value =>
                form.setFieldValue(
                  'reminder_minutes',
                  value.slice(-REMINDERS_MAX).map(Number)
                )
              }
            >
              <Group gap={6}>
                {REMINDER_CHOICES.map(minutes => (
                  <Chip key={minutes} value={String(minutes)} size="xs">
                    {reminderLabels[minutes]}
                  </Chip>
                ))}
              </Group>
            </Chip.Group>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('reminders_hint')}
            </p>
          </div>
          <Group grow align="flex-start">
            <NumberInput
              label={t('min_notice')}
              min={0}
              max={43200}
              allowDecimal={false}
              {...form.getInputProps('min_notice_minutes')}
            />
            <NumberInput
              label={t('window_days')}
              min={1}
              max={365}
              allowDecimal={false}
              {...form.getInputProps('window_days')}
            />
            <NumberInput
              label={t('max_per_day')}
              min={1}
              max={1000}
              allowDecimal={false}
              {...form.getInputProps('max_per_day')}
            />
          </Group>
        </Stack>

        <Group justify="flex-end" gap="xs">
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
