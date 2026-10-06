import type {
  BookingRules,
  FormField,
  FormFieldInput,
} from '@internal/core/types/Form';

export const REMINDER_CHOICES = [60, 120, 360, 1440, 2880, 10080] as const;
export const REMINDERS_MAX = 3;

export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export type CategoryValues = { id: string; name: string };

export type ServiceValues = {
  key: string;
  id?: string;
  categoryId: string;
  name: string;
  duration: number | '';
  price: number | '';
  currency: string;
  capacity: number | '';
  days: string[];
  times: { key: string; value: string }[];
  byDay: Record<string, { key: string; value: string }[]>;
  bundle: boolean;
  bundleTake: number | '';
  bundlePay: number | '';
};

export type ExceptionValues = {
  key: string;
  id?: string;
  kind: 'closed' | 'special';
  from: string;
  to: string;
  times: { key: string; value: string }[];
  serviceIds: string[];
  note: string;
};

export type Values = {
  label: string;
  help: string;
  categories: CategoryValues[];
  services: ServiceValues[];
  exceptions: ExceptionValues[];
  approval: 'auto' | 'manual';
  approval_timeout_minutes: number | '';
  approval_on_timeout: 'decline' | 'accept';
  approval_soon_only: boolean;
  approval_within_minutes: number | '';
  reminder_minutes: number[];
  min_notice_minutes: number | '';
  window_days: number | '';
  max_per_day: number | '';
};

export const newKey = () => Math.random().toString(36).slice(2);

const ALPHANUMERIC =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export const newCategoryId = () =>
  Array.from(
    { length: 8 },
    () => ALPHANUMERIC[Math.floor(Math.random() * ALPHANUMERIC.length)]
  ).join('');

export const MAX_CATEGORIES = 10;

export const isGrouped = (values: Values) => values.categories.length >= 2;

export function splitIntoCategories(
  values: Values,
  names: [string, string]
): Values {
  if (isGrouped(values)) return values;
  const first = values.categories[0] ?? { id: newCategoryId(), name: names[0] };
  const second = { id: newCategoryId(), name: names[1] };
  return {
    ...values,
    categories: [first, second],
    services: values.services.map(service => ({
      ...service,
      categoryId: first.id,
    })),
  };
}

export function removeCategory(
  values: Values,
  id: string,
  moveTo: string
): Values {
  if (id === moveTo || !values.categories.some(item => item.id === moveTo)) {
    return values;
  }
  return {
    ...values,
    categories: values.categories.filter(item => item.id !== id),
    services: values.services.map(service =>
      service.categoryId === id ? { ...service, categoryId: moveTo } : service
    ),
  };
}

export const blankException = (): ExceptionValues => ({
  key: newKey(),
  kind: 'closed',
  from: '',
  to: '',
  times: [{ key: newKey(), value: '09:00' }],
  serviceIds: [],
  note: '',
});

export const blankService = (name: string, categoryId = ''): ServiceValues => ({
  key: newKey(),
  categoryId,
  name,
  duration: 60,
  price: '',
  currency: '',
  capacity: '',
  days: ['mon', 'tue', 'wed', 'thu', 'fri'],
  times: [{ key: newKey(), value: '09:00' }],
  byDay: {},
  bundle: false,
  bundleTake: 5,
  bundlePay: 4,
});

export function initialValues(field?: FormField): Values {
  const rules = field?.rules;
  return {
    label: field?.label ?? '',
    help: field?.help ?? '',
    categories: (field?.categories ?? []).map(item => ({
      id: item.id,
      name: item.name,
    })),
    services: (field?.services ?? []).map(service => ({
      key: service.id,
      id: service.id,
      categoryId: service.category_id ?? field?.categories?.[0]?.id ?? '',
      name: service.name,
      duration: service.duration,
      price: service.price ?? '',
      currency: service.currency ?? '',
      capacity: service.capacity ?? '',
      days: service.days,
      times: service.times.map(value => ({ key: newKey(), value })),
      bundle: Boolean(service.bundle),
      bundleTake: service.bundle?.take ?? 5,
      bundlePay: service.bundle?.pay ?? 4,
      byDay: Object.fromEntries(
        Object.entries(service.times_by_day ?? {}).map(([day, list]) => [
          day,
          list.map(value => ({ key: newKey(), value })),
        ])
      ),
    })),
    exceptions: (field?.exceptions ?? []).map(item => ({
      key: item.id,
      id: item.id,
      kind: item.kind,
      from: item.from,
      to: item.to && item.to !== item.from ? item.to : '',
      times: (item.times ?? []).map(value => ({ key: newKey(), value })),
      serviceIds: item.service_ids ?? [],
      note: item.note ?? '',
    })),
    approval: rules?.approval ?? 'auto',
    approval_timeout_minutes: rules?.approval_timeout_minutes ?? 1440,
    approval_on_timeout: rules?.approval_on_timeout ?? 'decline',
    approval_soon_only: rules?.approval_within_minutes != null,
    approval_within_minutes: rules?.approval_within_minutes ?? 2880,
    reminder_minutes: [...(rules?.reminder_minutes ?? [1440])].sort(
      (a, b) => b - a
    ),
    min_notice_minutes: rules?.min_notice_minutes ?? 0,
    window_days: rules?.window_days ?? 60,
    max_per_day: rules?.max_per_day ?? '',
  };
}

const orNull = (value: number | '') => (value === '' ? null : value);

export function toBookingInput(
  values: Values,
  creating: boolean
): FormFieldInput {
  const rules: Partial<BookingRules> = {
    approval: values.approval,
    min_notice_minutes:
      values.min_notice_minutes === '' ? 0 : values.min_notice_minutes,
    window_days: values.window_days === '' ? 60 : values.window_days,
  };
  if (values.approval === 'manual') {
    rules.approval_timeout_minutes =
      values.approval_timeout_minutes === ''
        ? 1440
        : values.approval_timeout_minutes;
    rules.approval_on_timeout = values.approval_on_timeout;
  }
  rules.approval_within_minutes =
    values.approval === 'manual' &&
    values.approval_soon_only &&
    values.approval_within_minutes !== ''
      ? values.approval_within_minutes
      : null;
  rules.reminder_minutes = [...new Set(values.reminder_minutes)].sort(
    (a, b) => b - a
  );
  const maxPerDay = orNull(values.max_per_day);
  if (maxPerDay !== null) rules.max_per_day = maxPerDay;

  const grouped = isGrouped(values);
  const input: FormFieldInput = {
    label: values.label.trim(),
    help: values.help.trim() || (creating ? undefined : null),
    categories: grouped
      ? values.categories.map(item => ({
          id: item.id,
          name: item.name.trim(),
        }))
      : [],
    services: values.services.map(service => {
      const price = orNull(service.price);
      const capacity = orNull(service.capacity);
      const ownDays = DAYS.filter(
        day => service.days.includes(day) && service.byDay[day]
      );
      const byDay = ownDays.length
        ? Object.fromEntries(
            ownDays.map(day => [
              day,
              [...new Set(service.byDay[day].map(time => time.value))].sort(),
            ])
          )
        : undefined;
      return {
        ...(service.id ? { id: service.id } : {}),
        ...(grouped ? { category_id: service.categoryId } : {}),
        name: service.name.trim(),
        duration: Number(service.duration),
        ...(price !== null
          ? { price, currency: service.currency.trim().toUpperCase() }
          : {}),
        ...(capacity !== null ? { capacity } : {}),
        days: DAYS.filter(day => service.days.includes(day)),
        times: [...new Set(service.times.map(time => time.value))].sort(),
        ...(byDay ? { times_by_day: byDay } : {}),
        ...(price !== null &&
        service.bundle &&
        service.bundleTake !== '' &&
        service.bundlePay !== ''
          ? { bundle: { take: service.bundleTake, pay: service.bundlePay } }
          : {}),
      };
    }),
    rules,
    exceptions: values.exceptions.map(item => {
      const to = item.to && item.to !== item.from ? item.to : undefined;
      const note = item.note.trim();
      return {
        ...(item.id ? { id: item.id } : {}),
        from: item.from,
        ...(to ? { to } : {}),
        kind: item.kind,
        ...(item.kind === 'special'
          ? { times: [...new Set(item.times.map(time => time.value))].sort() }
          : {}),
        ...(item.serviceIds.length > 0 ? { service_ids: item.serviceIds } : {}),
        ...(note ? { note } : {}),
      };
    }),
  };
  if (creating) input.type = 'booking';
  return input;
}
