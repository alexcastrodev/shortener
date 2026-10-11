import type { BookingAvailability } from '@internal/core/types/Form';
import { defaultTimes } from './time-generator.ts';
import {
  DAYS,
  newKey,
  type SchedulePath,
  type ScheduleValues,
  type Values,
} from './values.ts';

export const scheduleAt = (
  values: Values,
  path: SchedulePath
): ScheduleValues =>
  path === 'availability'
    ? values.availability
    : values.services[Number(path.slice('services.'.length))];

export const toSchedule = (
  source: Partial<BookingAvailability> | undefined
): ScheduleValues => ({
  days: source?.days ?? [],
  times: (source?.times ?? []).map(value => ({ key: newKey(), value })),
  byDay: Object.fromEntries(
    Object.entries(source?.times_by_day ?? {}).map(([day, list]) => [
      day,
      list.map(value => ({ key: newKey(), value })),
    ])
  ),
});

export const fromSchedule = (schedule: ScheduleValues): BookingAvailability => {
  const ownDays = DAYS.filter(
    day => schedule.days.includes(day) && schedule.byDay[day]
  );
  return {
    days: DAYS.filter(day => schedule.days.includes(day)),
    times: [...new Set(schedule.times.map(time => time.value))].sort(),
    ...(ownDays.length
      ? {
          times_by_day: Object.fromEntries(
            ownDays.map(day => [
              day,
              [...new Set(schedule.byDay[day].map(time => time.value))].sort(),
            ])
          ),
        }
      : {}),
  };
};

export const blankSchedule = (duration: number): ScheduleValues => ({
  days: ['mon', 'tue', 'wed', 'thu', 'fri'],
  times: defaultTimes(duration).map(value => ({ key: newKey(), value })),
  byDay: {},
});
