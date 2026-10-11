import type {
  BookingRules,
  FormField,
  FormFieldInput,
} from '@internal/core/types/Form';
import {
  newKey,
  orNull,
  type ExceptionValues,
  type FormValues,
} from './values.ts';

export const blankException = (): ExceptionValues => ({
  key: newKey(),
  kind: 'closed',
  from: '',
  to: '',
  times: [{ key: newKey(), value: '09:00' }],
  serviceIds: [],
  note: '',
});

export function baseValues(field?: FormField): FormValues {
  const rules = field?.rules;
  return {
    label: field?.label ?? '',
    help: field?.help ?? '',
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
    exceptionDraft: blankException(),
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

export function baseInput(
  values: FormValues,
  creating: boolean
): FormFieldInput {
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

  return {
    label: values.label.trim(),
    help: values.help.trim() || (creating ? undefined : null),
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
    ...(creating ? { type: 'booking' as const } : {}),
  };
}
