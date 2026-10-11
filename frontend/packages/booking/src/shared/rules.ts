import type { BookingRules } from '@internal/core/types/Form';
import { orNull, type RuleValues } from './values.ts';

export function ruleValues(rules?: Partial<BookingRules>): RuleValues {
  return {
    approval: rules?.approval ?? 'auto',
    approval_timeout_minutes: rules?.approval_timeout_minutes ?? 1440,
    approval_on_timeout: rules?.approval_on_timeout ?? 'decline',
    approval_soon_only: rules?.approval_within_minutes != null,
    approval_within_minutes: rules?.approval_within_minutes ?? 2880,
    verify_email: rules?.verify_email === true,
    waitlist: rules?.waitlist === true,
    waitlist_confirm_minutes: rules?.waitlist_confirm_minutes ?? 120,
    reminder_minutes: [...(rules?.reminder_minutes ?? [1440])].sort(
      (a, b) => b - a
    ),
    min_notice_minutes: rules?.min_notice_minutes ?? 0,
    window_days: rules?.window_days ?? 60,
    buffer_minutes: rules?.buffer_minutes ?? 0,
    max_per_day: rules?.max_per_day ?? '',
  };
}

export function ruleInput(values: RuleValues): Partial<BookingRules> {
  const rules: Partial<BookingRules> = {
    approval: values.approval,
    min_notice_minutes:
      values.min_notice_minutes === '' ? 0 : values.min_notice_minutes,
    window_days: values.window_days === '' ? 60 : values.window_days,
    buffer_minutes: values.buffer_minutes === '' ? 0 : values.buffer_minutes,
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
  rules.verify_email = values.approval === 'auto' && values.verify_email;
  rules.waitlist = values.waitlist;
  rules.waitlist_confirm_minutes =
    values.waitlist && values.waitlist_confirm_minutes !== ''
      ? values.waitlist_confirm_minutes
      : null;
  rules.reminder_minutes = [...new Set(values.reminder_minutes)].sort(
    (a, b) => b - a
  );
  const maxPerDay = orNull(values.max_per_day);
  if (maxPerDay !== null) rules.max_per_day = maxPerDay;
  return rules;
}

export const RULE_FIELDS = Object.keys(ruleValues());
