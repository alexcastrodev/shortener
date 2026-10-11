import { ActionIcon, Button, Chip, Group, TextInput } from '@mantine/core';
import type { UseFormReturnType } from '@mantine/form';
import { IconPlus, IconX } from '@tabler/icons-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DAYS,
  newKey,
  scheduleAt,
  type SchedulePath,
  type Values,
} from '@internal/booking';
import { TimeGeneratorPanel } from './time-generator-panel';
import { WeekdayTimes } from './weekday-times';

export function ScheduleFields({
  form,
  path,
  duration,
  dayLabels,
}: {
  form: UseFormReturnType<Values>;
  path: SchedulePath;
  duration: number;
  dayLabels: Record<(typeof DAYS)[number], string>;
}) {
  const { t } = useTranslation('booking');
  const id = useId();
  const schedule = scheduleAt(form.values, path);
  const daysError = form.errors[`${path}.days`];
  const timesError = form.errors[`${path}.times`];
  const key = 'key' in schedule ? schedule.key : undefined;

  const livePath = (): SchedulePath | null => {
    if (path === 'availability') return path;
    const at = form.getValues().services.findIndex(item => item.key === key);
    return at < 0 ? null : `services.${at}`;
  };

  return (
    <>
      <div role="group" aria-labelledby={`${id}-days`}>
        <p id={`${id}-days`} className="mb-1 text-sm font-medium">
          {t('service_days')}
        </p>
        <Chip.Group
          multiple
          value={schedule.days}
          onChange={value => form.setFieldValue(`${path}.days`, value)}
        >
          <Group gap={6}>
            {DAYS.map(day => (
              <Chip key={day} value={day} size="xs">
                {dayLabels[day]}
              </Chip>
            ))}
          </Group>
        </Chip.Group>
        {typeof daysError === 'string' && (
          <p className="mt-1 text-xs text-red-500">{daysError}</p>
        )}
      </div>
      <div role="group" aria-labelledby={`${id}-times`}>
        <p id={`${id}-times`} className="mb-1 text-sm font-medium">
          {t('service_times')}
        </p>
        <Group gap="xs">
          {schedule.times.map((time, timeIndex) => (
            <Group key={time.key} gap={2} wrap="nowrap">
              <TextInput
                type="time"
                size="xs"
                aria-label={t('service_times')}
                {...form.getInputProps(`${path}.times.${timeIndex}.value`)}
              />
              <ActionIcon
                variant="subtle"
                color="gray"
                aria-label={t('service_remove_time', { time: time.value })}
                onClick={() => form.removeListItem(`${path}.times`, timeIndex)}
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
              form.insertListItem(`${path}.times`, { key: newKey(), value: '' })
            }
          >
            {t('service_add_time')}
          </Button>
        </Group>
        {typeof timesError === 'string' && (
          <p className="mt-1 text-xs text-red-500">{timesError}</p>
        )}
        <div className="mt-2">
          <TimeGeneratorPanel
            duration={duration}
            hasTimes={schedule.times.length > 0}
            onApply={times => {
              const target = livePath();
              if (!target) return;
              form.setFieldValue(
                `${target}.times`,
                times.map(value => ({ key: newKey(), value }))
              );
            }}
          />
        </div>
      </div>
      <WeekdayTimes form={form} path={path} dayLabels={dayLabels} />
    </>
  );
}
