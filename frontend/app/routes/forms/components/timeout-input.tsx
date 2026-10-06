import { Group, NumberInput, Select } from '@mantine/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  joinMinutes,
  splitMinutes,
  type Unit,
} from '../../../modules/forms/duration-units.ts';

export function TimeoutInput({
  minutes,
  error,
  onChange,
}: {
  minutes: number | '';
  error?: string;
  onChange: (minutes: number | '') => void;
}) {
  const { t } = useTranslation('booking');
  const initial = splitMinutes(minutes === '' ? 1440 : minutes);
  const [unit, setUnit] = useState<Unit>(initial.unit);
  const amount =
    minutes === ''
      ? ''
      : minutes / (unit === 'days' ? 1440 : unit === 'hours' ? 60 : 1);

  return (
    <div>
      <p className="mb-1 text-sm">{t('approval_timeout')}</p>
      <Group gap="xs" wrap="nowrap" align="flex-start">
        <NumberInput
          aria-label={t('approval_timeout')}
          min={1}
          decimalScale={unit === 'minutes' ? 0 : 2}
          value={amount}
          error={error}
          onChange={value =>
            onChange(joinMinutes(value === '' ? '' : Number(value), unit))
          }
        />
        <Select
          aria-label={t('approval_timeout')}
          allowDeselect={false}
          data={[
            { value: 'minutes', label: t('unit_minutes') },
            { value: 'hours', label: t('unit_hours') },
            { value: 'days', label: t('unit_days') },
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
      <p className="mt-1 text-xs text-muted-foreground">{t('timeout_range')}</p>
    </div>
  );
}
