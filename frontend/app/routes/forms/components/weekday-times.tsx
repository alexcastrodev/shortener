import {
  ActionIcon,
  Button,
  Checkbox,
  Group,
  Stack,
  TextInput,
} from '@mantine/core';
import type { UseFormReturnType } from '@mantine/form';
import { IconPlus, IconX } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import {
  DAYS,
  newKey,
  type Values,
} from '../../../modules/forms/booking-config.ts';

export function WeekdayTimes({
  form,
  index,
  dayLabels,
}: {
  form: UseFormReturnType<Values>;
  index: number;
  dayLabels: Record<(typeof DAYS)[number], string>;
}) {
  const { t } = useTranslation('booking');
  const service = form.values.services[index];
  const days = DAYS.filter(day => service.days.includes(day));
  if (days.length === 0) return null;

  const path = (day: string) => `services.${index}.byDay.${day}` as const;
  const setOwn = (day: string, own: boolean) => {
    const rest = { ...service.byDay };
    if (own)
      rest[day] = service.times.map(time => ({
        key: newKey(),
        value: time.value,
      }));
    else delete rest[day];
    form.setFieldValue(`services.${index}.byDay`, rest);
  };

  return (
    <div>
      <p className="text-sm font-medium">{t('wd_title')}</p>
      <p className="mb-2 text-xs text-muted-foreground">{t('wd_hint')}</p>
      <Stack gap="xs">
        {days.map(day => {
          const own = service.byDay[day];
          return (
            <div key={day}>
              <Checkbox
                size="xs"
                label={`${dayLabels[day]} · ${t('wd_own')}`}
                checked={own !== undefined}
                onChange={event => setOwn(day, event.currentTarget.checked)}
              />
              {own !== undefined && (
                <Group gap="xs" mt={4} ml={24}>
                  {own.map((time, timeIndex) => (
                    <Group key={time.key} gap={2} wrap="nowrap">
                      <TextInput
                        type="time"
                        size="xs"
                        aria-label={t('wd_times', { day: dayLabels[day] })}
                        {...form.getInputProps(
                          `${path(day)}.${timeIndex}.value`
                        )}
                      />
                      <ActionIcon
                        variant="subtle"
                        color="gray"
                        aria-label={t('wd_remove_time', { time: time.value })}
                        onClick={() =>
                          form.removeListItem(path(day), timeIndex)
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
                      form.insertListItem(path(day), {
                        key: newKey(),
                        value: '',
                      })
                    }
                  >
                    {t('wd_add_time')}
                  </Button>
                  {own.length === 0 && (
                    <span className="text-xs text-muted-foreground">
                      {t('wd_closed')}
                    </span>
                  )}
                </Group>
              )}
            </div>
          );
        })}
      </Stack>
    </div>
  );
}
