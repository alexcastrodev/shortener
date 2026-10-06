import type {
  AppointmentStatus,
  FormAppointmentFilters,
} from '@internal/core/actions/get-form-appointments/get-form-appointments.types';

export const STATUS_OPTIONS: AppointmentStatus[] = [
  'pending',
  'confirmed',
  'cancelled',
  'declined',
  'expired',
  'rescheduled',
];

export type FilterValues = {
  status: AppointmentStatus | '';
  q: string;
  from: string;
  to: string;
};

export const emptyFilters: FilterValues = {
  status: '',
  q: '',
  from: '',
  to: '',
};

export function toFilters(values: FilterValues): FormAppointmentFilters {
  const filters: FormAppointmentFilters = {};
  if (values.status) filters.status = values.status;
  const q = values.q.trim();
  if (q) filters.q = q;
  if (values.from) filters.from = values.from;
  if (values.to) filters.to = values.to;
  return filters;
}

export const hasFilters = (values: FilterValues) =>
  Object.keys(toFilters(values)).length > 0;

export function dateRangeProblem(values: FilterValues) {
  return Boolean(values.from && values.to && values.to < values.from);
}

export function exportName(title: string | undefined, format: 'csv' | 'xlsx') {
  const base =
    (title ?? 'form').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '') ||
    'form';
  return `${base}-appointments.${format}`;
}
