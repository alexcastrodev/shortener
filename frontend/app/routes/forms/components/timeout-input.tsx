import { Group, NumberInput, Select } from '@mantine/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MAX_TIMEOUT,
  MIN_TIMEOUT,
  UNIT_MINUTES,
  amountBound,
  joinMinutes,
  splitMinutes,
  type Unit,
} from '../../../modules/forms/duration-units.ts';

export function TimeoutInput({
  minutes,
  error,
  label,
  hint,
  min = MIN_TIMEOUT,
  max = MAX_TIMEOUT,
  onChange,
}: {
  minutes: number | '';
  error?: string;
  label?: string;
  hint?: string;
  min?: number;
  max?: number;
  onChange: (minutes: number | '') => void;
}) {
  const { t } = useTranslation('booking');
  const initial = splitMinutes(minutes === '' ? 1440 : minutes);
  const [unit, setUnit] = useState<Unit>(initial.unit);
  const amount = minutes === '' ? '' : minutes / UNIT_MINUTES[unit];

  const shown = amount === '' ? 2 : amount;

  return (
    <div>
      <p className="mb-1 text-sm">{label ?? t('approval_timeout')}</p>
      <Group gap="xs" wrap="nowrap" align="flex-start">
        <NumberInput
          aria-label={label ?? t('approval_timeout')}
          min={amountBound(min, unit)}
          max={amountBound(max, unit)}
          decimalScale={unit === 'minutes' ? 0 : 2}
          value={amount}
          error={error}
          onChange={value =>
            onChange(joinMinutes(value === '' ? '' : Number(value), unit))
          }
        />
        <Select
          aria-label={label ?? t('approval_timeout')}
          allowDeselect={false}
          data={[
            { value: 'minutes', label: t('unit_minutes', { count: shown }) },
            { value: 'hours', label: t('unit_hours', { count: shown }) },
            { value: 'days', label: t('unit_days', { count: shown }) },
          ]}
          value={unit}
          onChange={value => {
            const next = (value as Unit) ?? 'minutes';
            const current = minutes === '' ? '' : minutes;
            setUnit(next);
            onChange(current);
          }}
        />
      </Group>
      <p className="mt-1 text-xs text-muted-foreground">
        {hint ?? t('timeout_range')}
      </p>
    </div>
  );
}
