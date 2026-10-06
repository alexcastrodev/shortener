import type {
  BookingRules,
  FormField,
  FormFieldInput,
} from '@internal/core/types/Form';

export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export type ServiceValues = {
  key: string;
  id?: string;
  name: string;
  duration: number | '';
  price: number | '';
  currency: string;
  capacity: number | '';
  days: string[];
  times: { key: string; value: string }[];
};

export type Values = {
  label: string;
  help: string;
  services: ServiceValues[];
  approval: 'auto' | 'manual';
  approval_timeout_minutes: number | '';
  approval_on_timeout: 'decline' | 'accept';
  min_notice_minutes: number | '';
  window_days: number | '';
  max_per_day: number | '';
};

export const newKey = () => Math.random().toString(36).slice(2);

export const blankService = (name: string): ServiceValues => ({
  key: newKey(),
  name,
  duration: 60,
  price: '',
  currency: '',
  capacity: '',
  days: ['mon', 'tue', 'wed', 'thu', 'fri'],
  times: [{ key: newKey(), value: '09:00' }],
});

export function initialValues(field?: FormField): Values {
  const rules = field?.rules;
  return {
    label: field?.label ?? '',
    help: field?.help ?? '',
    services: (field?.services ?? []).map(service => ({
      key: service.id,
      id: service.id,
      name: service.name,
      duration: service.duration,
      price: service.price ?? '',
      currency: service.currency ?? '',
      capacity: service.capacity ?? '',
      days: service.days,
      times: service.times.map(value => ({ key: newKey(), value })),
    })),
    approval: rules?.approval ?? 'auto',
    approval_timeout_minutes: rules?.approval_timeout_minutes ?? 1440,
    approval_on_timeout: rules?.approval_on_timeout ?? 'decline',
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
  const maxPerDay = orNull(values.max_per_day);
  if (maxPerDay !== null) rules.max_per_day = maxPerDay;

  const input: FormFieldInput = {
    label: values.label.trim(),
    help: values.help.trim() || (creating ? undefined : null),
    services: values.services.map(service => {
      const price = orNull(service.price);
      const capacity = orNull(service.capacity);
      return {
        ...(service.id ? { id: service.id } : {}),
        name: service.name.trim(),
        duration: Number(service.duration),
        ...(price !== null
          ? { price, currency: service.currency.trim().toUpperCase() }
          : {}),
        ...(capacity !== null ? { capacity } : {}),
        days: DAYS.filter(day => service.days.includes(day)),
        times: [...new Set(service.times.map(time => time.value))].sort(),
      };
    }),
    rules,
  };
  if (creating) input.type = 'booking';
  return input;
}
