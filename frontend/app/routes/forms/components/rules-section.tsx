import {
  Chip,
  Group,
  NumberInput,
  SegmentedControl,
  Stack,
  Switch,
} from '@mantine/core';
import type { UseFormReturnType } from '@mantine/form';
import { useTranslation } from 'react-i18next';
import {
  REMINDERS_MAX,
  REMINDER_CHOICES,
  type Values,
} from '../../../modules/forms/booking-config.ts';
import { splitMinutes } from '../../../modules/forms/duration-units.ts';
import { summarizeRules } from '../../../modules/forms/rules-summary.ts';
import { SummarySection, useOpenOnErrors } from './summary-section';
import { TimeoutInput } from './timeout-input';

const RULE_FIELDS = [
  'approval',
  'approval_timeout_minutes',
  'approval_on_timeout',
  'approval_soon_only',
  'approval_within_minutes',
  'verify_email',
  'waitlist',
  'waitlist_confirm_minutes',
  'reminder_minutes',
  'min_notice_minutes',
  'window_days',
  'buffer_minutes',
  'max_per_day',
];

const ownsError = (key: string) =>
  RULE_FIELDS.some(name => key === name || key.startsWith(`${name}.`));

export function RulesSection({
  form,
  timeZone,
}: {
  form: UseFormReturnType<Values>;
  timeZone?: string;
}) {
  const { t } = useTranslation('booking');
  const [open, setOpen] = useOpenOnErrors(form.errors, ownsError);

  const reminderLabels: Record<(typeof REMINDER_CHOICES)[number], string> = {
    60: t('reminder_60'),
    120: t('reminder_120'),
    360: t('reminder_360'),
    1440: t('reminder_1440'),
    2880: t('reminder_2880'),
    10080: t('reminder_10080'),
  };

  const duration = (minutes: number) => {
    const { amount, unit } = splitMinutes(minutes);
    const label =
      unit === 'days'
        ? t('unit_days', { count: amount })
        : unit === 'hours'
          ? t('unit_hours', { count: amount })
          : t('unit_minutes', { count: amount });
    return `${amount} ${label}`;
  };

  const reminderWhen = (minutes: number) =>
    reminderLabels[minutes as (typeof REMINDER_CHOICES)[number]] ??
    duration(minutes);

  const summary = summarizeRules(form.values, {
    auto: t('rules_sum_auto'),
    autoVerify: t('rules_sum_auto_verify'),
    manual: t('rules_sum_manual'),
    waitlist: t('rules_sum_waitlist'),
    reminders: minutes =>
      t('rules_sum_reminders', {
        count: minutes.length,
        list: minutes.map(reminderWhen).join(', '),
      }),
    window: days => t('rules_sum_window', { count: days }),
    notice: minutes => t('rules_sum_notice', { time: duration(minutes) }),
    buffer: minutes => t('rules_sum_buffer', { count: minutes }),
    maxPerDay: count => t('rules_sum_max', { count }),
  });

  return (
    <SummarySection
      title={t('rules_title')}
      summary={summary}
      open={open}
      onToggle={() => setOpen(current => !current)}
    >
      <Stack gap="lg">
        {timeZone && (
          <div>
            <p className="text-sm font-medium">{t('time_zone')}</p>
            <p className="text-sm">{timeZone}</p>
            <p className="text-xs text-muted-foreground">
              {t('time_zone_hint')}
            </p>
          </div>
        )}
        <Stack gap="sm">
          <p className="text-sm font-medium">{t('approval')}</p>
          <SegmentedControl
            aria-label={t('approval')}
            data={[
              { value: 'auto', label: t('approval_auto') },
              { value: 'manual', label: t('approval_manual') },
            ]}
            value={form.values.approval}
            onChange={value =>
              form.setFieldValue('approval', value as 'auto' | 'manual')
            }
          />
          {form.values.approval === 'auto' && (
            <Switch
              label={t('verify_email')}
              description={t('verify_email_hint')}
              checked={form.values.verify_email}
              onChange={event =>
                form.setFieldValue('verify_email', event.currentTarget.checked)
              }
            />
          )}
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
            <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
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
                  aria-label={t('approval_on_timeout')}
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
            </div>
          )}
        </Stack>
        <Stack gap="xs">
          <Switch
            label={t('waitlist')}
            description={t('waitlist_hint')}
            checked={form.values.waitlist}
            onChange={event =>
              form.setFieldValue('waitlist', event.currentTarget.checked)
            }
          />
          {form.values.waitlist && (
            <TimeoutInput
              label={t('waitlist_confirm')}
              hint={t('waitlist_confirm_range')}
              min={15}
              max={4320}
              minutes={form.values.waitlist_confirm_minutes}
              error={form.errors.waitlist_confirm_minutes as string | undefined}
              onChange={value =>
                form.setFieldValue('waitlist_confirm_minutes', value)
              }
            />
          )}
        </Stack>
        <div>
          <p className="mb-1 text-sm font-medium">{t('reminders')}</p>
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
        <Stack gap="sm">
          <p className="text-sm font-medium">{t('rules_limits')}</p>
          <TimeoutInput
            label={t('min_notice')}
            hint={t('min_notice_hint')}
            min={0}
            minutes={form.values.min_notice_minutes}
            onChange={value => form.setFieldValue('min_notice_minutes', value)}
          />
          <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-3">
            <NumberInput
              label={t('window_days')}
              min={1}
              max={365}
              allowDecimal={false}
              {...form.getInputProps('window_days')}
            />
            <NumberInput
              label={t('buffer_minutes')}
              min={0}
              max={600}
              allowDecimal={false}
              {...form.getInputProps('buffer_minutes')}
            />
            <NumberInput
              label={t('max_per_day')}
              min={1}
              max={1000}
              allowDecimal={false}
              {...form.getInputProps('max_per_day')}
            />
          </div>
        </Stack>
      </Stack>
    </SummarySection>
  );
}
