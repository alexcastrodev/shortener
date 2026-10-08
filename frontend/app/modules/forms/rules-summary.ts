import { TIME } from './booking-config.ts';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SEPARATOR = ' · ';

export type ExceptionSummaryItem = {
  kind: 'closed' | 'special';
  from: string;
  to: string;
  times: { value: string }[];
};

export type ExceptionSummaryLabels = {
  none: string;
  closed: string;
  special: (times: string) => string;
  more: (count: number) => string;
  date: (iso: string) => string;
};

export function summarizeExceptions(
  items: ExceptionSummaryItem[],
  labels: ExceptionSummaryLabels,
  limit = 2
) {
  const parts = items
    .filter(item => DATE.test(item.from))
    .sort((a, b) => a.from.localeCompare(b.from))
    .map(item => {
      const range =
        item.to && item.to !== item.from
          ? `${labels.date(item.from)} – ${labels.date(item.to)}`
          : labels.date(item.from);
      if (item.kind === 'closed') return `${range} ${labels.closed}`;
      const times = [
        ...new Set(item.times.map(time => time.value).filter(v => TIME.test(v))),
      ].sort();
      return `${range} ${labels.special(times.join(', '))}`;
    });
  if (parts.length === 0) return labels.none;
  const shown = parts.slice(0, limit);
  if (parts.length > limit) shown.push(labels.more(parts.length - limit));
  return shown.join(SEPARATOR);
}

export type RulesSummaryValues = {
  approval: 'auto' | 'manual';
  verify_email: boolean;
  waitlist: boolean;
  reminder_minutes: number[];
  min_notice_minutes: number | '';
  window_days: number | '';
  buffer_minutes: number | '';
  max_per_day: number | '';
};

export type RulesSummaryLabels = {
  auto: string;
  autoVerify: string;
  manual: string;
  waitlist: string;
  reminders: (minutes: number[]) => string;
  window: (days: number) => string;
  notice: (minutes: number) => string;
  buffer: (minutes: number) => string;
  maxPerDay: (count: number) => string;
};

export function summarizeRules(
  values: RulesSummaryValues,
  labels: RulesSummaryLabels
) {
  const parts = [
    values.approval === 'manual'
      ? labels.manual
      : values.verify_email
        ? labels.autoVerify
        : labels.auto,
  ];
  if (values.waitlist) parts.push(labels.waitlist);
  const reminders = [...new Set(values.reminder_minutes)].sort((a, b) => b - a);
  if (reminders.length > 0) parts.push(labels.reminders(reminders));
  if (values.window_days !== '') parts.push(labels.window(values.window_days));
  if (values.min_notice_minutes !== '' && values.min_notice_minutes > 0) {
    parts.push(labels.notice(values.min_notice_minutes));
  }
  if (values.buffer_minutes !== '' && values.buffer_minutes > 0) {
    parts.push(labels.buffer(values.buffer_minutes));
  }
  if (values.max_per_day !== '') parts.push(labels.maxPerDay(values.max_per_day));
  return parts.join(SEPARATOR);
}
