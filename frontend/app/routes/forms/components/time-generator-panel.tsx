import {
  Button,
  Group,
  NumberInput,
  SegmentedControl,
  Stack,
  Switch,
  TextInput,
} from '@mantine/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGenerateAppointmentTimes } from '@internal/core/actions/generate-appointment-times/generate-appointment-times.hook';
import type { GenerateTimesError } from '@internal/core/actions/generate-appointment-times/generate-appointment-times.types';
import {
  STEP_PRESETS,
  defaultGenerator,
  toGenerateParams,
  type GeneratorValues,
} from '../../../modules/forms/time-generator.ts';

export function TimeGeneratorPanel({
  duration,
  hasTimes,
  onApply,
}: {
  duration: number;
  hasTimes: boolean;
  onApply: (times: string[]) => void;
}) {
  const { t } = useTranslation('booking');
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<GeneratorValues>(defaultGenerator);
  const [message, setMessage] = useState<{
    tone: 'ok' | 'error';
    text: string;
  } | null>(null);
  const { mutate, isPending } = useGenerateAppointmentTimes();

  const set = (patch: Partial<GeneratorValues>) =>
    setValues(current => ({ ...current, ...patch }));

  const errorText = (code: GenerateTimesError) => {
    switch (code) {
      case 'invalid_time':
        return t('gen_err_invalid_time');
      case 'invalid_step':
        return t('gen_err_invalid_step');
      case 'invalid_duration':
        return t('gen_err_invalid_duration');
      case 'invalid_range':
        return t('gen_err_invalid_range');
      case 'no_times':
        return t('gen_err_no_times');
      default:
        return t('gen_err_unknown');
    }
  };

  const run = () => {
    const params = toGenerateParams(values, duration);
    if (!params) {
      setMessage({ tone: 'error', text: t('gen_err_invalid_step') });
      return;
    }
    mutate(params, {
      onSuccess: result => {
        if (result.errors.length > 0) {
          setMessage({ tone: 'error', text: errorText(result.errors[0]) });
          return;
        }
        onApply(result.times);
        const overlap = result.warnings.includes('overlapping_sessions')
          ? ` ${t('gen_overlap')}`
          : '';
        setMessage({
          tone: 'ok',
          text: `${t('gen_result', { count: result.times.length })}${overlap}`,
        });
      },
      onError: () => setMessage({ tone: 'error', text: t('gen_err_unknown') }),
    });
  };

  if (!open) {
    return (
      <Button variant="subtle" size="compact-xs" onClick={() => setOpen(true)}>
        {t('gen_open')}
      </Button>
    );
  }

  return (
    <div className="rounded-lg border border-dashed border-border p-3">
      <Stack gap="sm">
        <Group justify="space-between">
          <p className="text-sm font-medium">{t('gen_title')}</p>
          <Button
            variant="subtle"
            size="compact-xs"
            onClick={() => setOpen(false)}
          >
            {t('gen_close')}
          </Button>
        </Group>
        <Group grow align="flex-end">
          <TextInput
            type="time"
            label={t('gen_from')}
            value={values.from}
            onChange={event => set({ from: event.currentTarget.value })}
          />
          <TextInput
            type="time"
            label={t('gen_to')}
            value={values.to}
            onChange={event => set({ to: event.currentTarget.value })}
          />
        </Group>
        <div>
          <p className="mb-1 text-sm">{t('gen_step')}</p>
          <SegmentedControl
            size="xs"
            value={String(values.step)}
            onChange={value =>
              set({ step: value === 'custom' ? 'custom' : Number(value) })
            }
            data={[
              ...STEP_PRESETS.map(step => ({
                value: String(step),
                label: t('gen_step_minutes', { count: step }),
              })),
              { value: 'custom', label: t('gen_step_custom') },
            ]}
          />
          {values.step === 'custom' && (
            <NumberInput
              mt="xs"
              label={t('gen_step_custom_label')}
              min={5}
              max={600}
              allowDecimal={false}
              value={values.customStep}
              onChange={value =>
                set({ customStep: value === '' ? '' : Number(value) })
              }
            />
          )}
        </div>
        <Switch
          label={t('gen_lunch')}
          checked={values.lunch}
          onChange={event => set({ lunch: event.currentTarget.checked })}
        />
        {values.lunch && (
          <Group grow>
            <TextInput
              type="time"
              label={t('gen_lunch_from')}
              value={values.lunchFrom}
              onChange={event => set({ lunchFrom: event.currentTarget.value })}
            />
            <TextInput
              type="time"
              label={t('gen_lunch_to')}
              value={values.lunchTo}
              onChange={event => set({ lunchTo: event.currentTarget.value })}
            />
          </Group>
        )}
        {hasTimes && (
          <p className="text-xs text-muted-foreground">{t('gen_replaces')}</p>
        )}
        <Group justify="space-between" align="center">
          <p
            role="status"
            className={`text-xs ${message?.tone === 'error' ? 'text-red-500' : 'text-muted-foreground'}`}
          >
            {message?.text}
          </p>
          <Button size="xs" color="brand" loading={isPending} onClick={run}>
            {t('gen_run')}
          </Button>
        </Group>
      </Stack>
    </div>
  );
}
