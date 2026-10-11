import type { FormField, FormFieldInput } from '@internal/core/types/Form';
import { ruleInput, ruleValues } from './rules.ts';
import { newKey, type ExceptionValues, type FormValues } from './values.ts';

export const blankException = (): ExceptionValues => ({
  key: newKey(),
  kind: 'closed',
  from: '',
  to: '',
  times: [{ key: newKey(), value: '09:00' }],
  serviceIds: [],
  note: '',
});

export const baseValues = (field?: FormField): FormValues => ({
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
  ...ruleValues(field?.rules),
});

export const baseInput = (
  values: FormValues,
  creating: boolean
): FormFieldInput => ({
  label: values.label.trim(),
  help: values.help.trim() || (creating ? undefined : null),
  rules: ruleInput(values),
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
});
