import type {
  BookingService,
  BookingServiceInput,
} from '@internal/core/types/Form';
import { blankSchedule, toSchedule } from './schedule.ts';
import {
  DEFAULT_CURRENCY,
  newKey,
  orNull,
  type ServiceValues,
} from './values.ts';

const DEFAULT_DURATION = 30;

export const blankService = (name: string, categoryId = ''): ServiceValues => ({
  key: newKey(),
  categoryId,
  name,
  duration: DEFAULT_DURATION,
  price: '',
  currency: DEFAULT_CURRENCY,
  capacity: 1,
  ownSchedule: false,
  ...blankSchedule(DEFAULT_DURATION),
  extraDurations: [],
  monthly: false,
  monthlyPrice: '',
  monthlyDuration: '',
});

export const serviceValues = (
  service: BookingService,
  categoryId: string
): ServiceValues => ({
  key: service.id,
  id: service.id,
  categoryId,
  name: service.name,
  duration: service.duration,
  price: service.price ?? '',
  currency: service.currency || DEFAULT_CURRENCY,
  capacity: service.capacity ?? '',
  ownSchedule: service.days !== undefined || service.times !== undefined,
  ...toSchedule(service),
  extraDurations: (service.extra_durations ?? []).map(item => ({
    key: newKey(),
    duration: item.duration,
    price: item.price ?? '',
  })),
  monthly: Boolean(service.monthly),
  monthlyPrice: service.monthly?.price ?? '',
  monthlyDuration: service.monthly?.duration ?? '',
});

export const serviceInput = (service: ServiceValues): BookingServiceInput => {
  const price = orNull(service.price);
  const capacity = orNull(service.capacity);
  const extras = service.extraDurations
    .filter(item => item.duration !== '')
    .map(item => ({
      duration: Number(item.duration),
      ...(price !== null && item.price !== '' ? { price: item.price } : {}),
    }));
  return {
    ...(service.id ? { id: service.id } : {}),
    name: service.name.trim(),
    duration: Number(service.duration),
    ...(price !== null
      ? { price, currency: service.currency.trim().toUpperCase() }
      : {}),
    ...(capacity !== null ? { capacity } : {}),
    ...(extras.length ? { extra_durations: extras } : {}),
    ...(service.monthly
      ? {
          monthly: {
            ...(price !== null && service.monthlyPrice !== ''
              ? { price: service.monthlyPrice }
              : {}),
            ...(service.monthlyDuration !== ''
              ? { duration: service.monthlyDuration }
              : {}),
          },
        }
      : {}),
  };
};
