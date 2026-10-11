export const REMINDER_CHOICES =[60, 120, 360, 1440, 2880, 10080] as const;
export const REMINDERS_MAX = 3;

export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export const DEFAULT_CURRENCY = 'EUR';
export const EXTRA_DURATIONS_MAX = 4;
export const ALLOWANCE_MAX = { month: 31, week: 7 } as const;

export type CategoryValues = { id: string; name: string };

export type ScheduleValues = {
  days: string[];
  times: { key: string; value: string }[];
  byDay: Record<string, { key: string; value: string }[]>;
};

export type SchedulePath = 'availability' | `services.${number}`;

export type ServiceValues = ScheduleValues & {
  key: string;
  id?: string;
  categoryId: string;
  name: string;
  duration: number | '';
  price: number | '';
  currency: string;
  capacity: number | '';
  ownSchedule: boolean;
  extraDurations: { key: string; duration: number | ''; price: number | '' }[];
  monthly: boolean;
  monthlyPrice: number | '';
  monthlyDuration: number | '';
  monthlySessions: number | '';
  monthlyPer: 'month' | 'week';
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

export type RuleValues = {
  approval: 'auto' | 'manual';
  approval_timeout_minutes: number | '';
  approval_on_timeout: 'decline' | 'accept';
  approval_soon_only: boolean;
  approval_within_minutes: number | '';
  reminder_minutes: number[];
  verify_email: boolean;
  waitlist: boolean;
  waitlist_confirm_minutes: number | '';
  multiple_services: boolean;
  min_notice_minutes: number | '';
  window_days: number | '';
  buffer_minutes: number | '';
  max_per_day: number | '';
};

export type FormValues = RuleValues & {
  label: string;
  help: string;
  exceptions: ExceptionValues[];
  exceptionDraft: ExceptionValues;
};

export type Values = FormValues & {
  availability: ScheduleValues;
  categories: CategoryValues[];
  services: ServiceValues[];
};

export const newKey = () => Math.random().toString(36).slice(2);

export const orNull = (value: number | '') => (value === '' ? null : value);
