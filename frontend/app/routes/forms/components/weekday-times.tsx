import { ActionIcon, Button, Group, Switch, TextInput } from '@mantine/core';
import type { UseFormReturnType } from '@mantine/form';
import { IconPlus, IconX } from '@tabler/icons-react';
import { useState } from 'react';
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
  const hasOwn = days.some(day => service.byDay[day] !== undefined);
  const [on, setOn] = useState(hasOwn);

  const path = (day: string) => `services.${index}.byDay.${day}` as const;
  const setOwn = (
    day: string,
    own: { key: string; value: string }[] | null
  ) => {
    const rest = { ...service.byDay };
    if (own) rest[day] = own;
    else delete rest[day];
    form.setFieldValue(`services.${index}.byDay`, rest);
  };
  const copyGeneral = () =>
    service.times.map(time => ({ key: newKey(), value: time.value }));

  return (
    <div>
      <Switch
        size="sm"
        label={t('wd_title')}
        description={t('wd_hint')}
        checked={on || hasOwn}
        onChange={event => {
          const checked = event.currentTarget.checked;
          setOn(checked);
          if (!checked) form.setFieldValue(`services.${index}.byDay`, {});
        }}
      />
      {(on || hasOwn) && days.length > 0 && (
        <ul className="mt-3 space-y-2">
          {days.map(day => {
            const own = service.byDay[day];
            return (
              <li
                key={day}
                role="group"
                aria-label={dayLabels[day]}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-border px-3 py-2"
              >
                <span className="w-10 shrink-0 text-sm font-medium">
                  {dayLabels[day]}
                </span>
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                  {own === undefined ? (
                    <span className="text-xs text-muted-foreground">
                      {t('wd_uses_general')}
                    </span>
                  ) : (
                    <>
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
                            aria-label={t('wd_remove_time', {
                              time: time.value,
                            })}
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
                    </>
                  )}
                </div>
                <Group gap={4} wrap="nowrap">
                  <Button
                    variant={own === undefined ? 'light' : 'subtle'}
                    color={own === undefined ? undefined : 'gray'}
                    size="compact-xs"
                    onClick={() =>
                      setOwn(day, own === undefined ? copyGeneral() : null)
                    }
                  >
                    {own === undefined
                      ? t('wd_customize')
                      : t('wd_use_general')}
                  </Button>
                  {own === undefined && (
                    <Button
                      variant="subtle"
                      color="gray"
                      size="compact-xs"
                      onClick={() => setOwn(day, [])}
                    >
                      {t('wd_close')}
                    </Button>
                  )}
                </Group>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
