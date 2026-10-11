import { Switch, TextInput } from '@mantine/core';
import { useTranslation } from 'react-i18next';
import { setOwnSchedule } from '@internal/booking';
import { ExtraDurations } from '../../extra-durations';
import { MonthlyOffer } from '../../monthly-offer';
import { ScheduleFields } from '../../schedule-fields';
import { ServiceBasics } from '../../service-basics';
import type { ItemFieldsProps } from '../editor-mode';

export function IndividualItemFields({
  form,
  index,
  dayLabels,
}: ItemFieldsProps) {
  const { t } = useTranslation('booking');
  const lesson = form.values.services[index];

  return (
    <>
      <TextInput
        label={t('lesson_name')}
        {...form.getInputProps(`services.${index}.name`)}
      />
      <ServiceBasics form={form} index={index} />
      <Switch
        size="sm"
        label={t('lesson_own_schedule')}
        description={t('lesson_own_schedule_hint')}
        checked={lesson.ownSchedule}
        onChange={event =>
          form.setFieldValue(
            `services.${index}`,
            setOwnSchedule(lesson, event.currentTarget.checked)
          )
        }
      />
      {lesson.ownSchedule && (
        <ScheduleFields
          form={form}
          path={`services.${index}`}
          duration={Number(lesson.duration) || 60}
          dayLabels={dayLabels}
        />
      )}
      <ExtraDurations form={form} index={index} />
      <MonthlyOffer form={form} index={index} />
    </>
  );
}
