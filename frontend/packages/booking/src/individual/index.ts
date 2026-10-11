import { z } from 'zod/v4';
import type { BookingMode } from '../mode.ts';
import { baseInput, baseValues } from '../shared/form.ts';
import { blankSchedule, fromSchedule, toSchedule } from '../shared/schedule.ts';
import { blankService, serviceInput, serviceValues } from '../shared/service.ts';
import {
  looseSchedule,
  requiredSchedule,
  scheduleIssues,
} from '../shared/validation.ts';
import type { ServiceValues } from '../shared/values.ts';

export const LESSON_DURATION = 60;

export const blankLesson = (name: string): ServiceValues => ({
  ...blankService(name),
  duration: LESSON_DURATION,
  days: [],
  times: [],
});

export const setOwnSchedule = (
  lesson: ServiceValues,
  ownSchedule: boolean
): ServiceValues => ({
  ...lesson,
  ownSchedule,
  ...(ownSchedule
    ? blankSchedule(Number(lesson.duration) || LESSON_DURATION)
    : { days: [], times: [], byDay: {} }),
});

export const individualMode: BookingMode = {
  name: 'individual',

  validation: {
    fields: t => ({ availability: z.object(requiredSchedule(t)) }),
    schedule: () => looseSchedule,
    itemIssues: (item, t) => (item.ownSchedule ? scheduleIssues(item, t) : []),
  },

  initialValues: field => ({
    ...baseValues(field),
    availability: toSchedule(field?.availability),
    categories: [],
    services: (field?.services ?? []).map(lesson => serviceValues(lesson, '')),
  }),

  newBooking: name => {
    const values = individualMode.initialValues();
    values.availability = blankSchedule(LESSON_DURATION);
    values.services = [blankLesson(name)];
    const { mode, availability, services } = individualMode.toBookingInput(
      values,
      true
    );
    return { mode, availability, services };
  },

  blankItem: (_values, name) => blankLesson(name),

  toBookingInput: (values, creating) => ({
    ...baseInput(values, creating),
    ...(creating ? { mode: 'individual' as const } : {}),
    availability: fromSchedule(values.availability),
    categories: [],
    services: values.services.map(lesson => ({
      ...serviceInput(lesson),
      ...(lesson.ownSchedule ? fromSchedule(lesson) : {}),
    })),
  }),

  compile: field => ({
    ...field,
    services: field.services?.map(lesson =>
      lesson.days?.length || lesson.times?.length
        ? lesson
        : { ...lesson, days: [], times: [], ...field.availability }
    ),
  }),

  scheduled: lesson => lesson.ownSchedule,

  groupOf: () => undefined,
};
