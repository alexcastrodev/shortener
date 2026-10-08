import { useState } from 'react';
import type { FormField } from '@internal/core/types/Form';
import type { Answer } from './field-inputs';

type Choice = string | null | undefined;

const hasValue = (value: unknown) => typeof value === 'string' && value.trim() !== '';

export function confirmEnabled(fields: FormField[]) {
  const booking = fields.find(field => field.type === 'booking');
  return (
    !!booking &&
    !(booking.verify_email ?? booking.rules?.verify_email) &&
    fields.some(field => field.type === 'email')
  );
}

export function confirmChoice(
  fields: FormField[],
  answers: Record<string, Answer>,
  choice: Choice
) {
  if (!confirmEnabled(fields)) return null;
  const filled = fields.filter(field => field.type === 'email' && hasValue(answers[field.id]));
  if (choice === undefined) return filled[0]?.id ?? null;
  return filled.find(field => field.id === choice)?.id ?? null;
}

export function useConfirmEmail(fields: FormField[], answers: Record<string, Answer>) {
  const [choice, setChoice] = useState<Choice>(undefined);
  const confirmFieldId = confirmChoice(fields, answers, choice);
  const enabled = confirmEnabled(fields);

  const confirmFor = (field: FormField) =>
    enabled && field.type === 'email' && hasValue(answers[field.id])
      ? {
          checked: confirmFieldId === field.id,
          onChange: (checked: boolean) => setChoice(checked ? field.id : null),
        }
      : undefined;

  return { confirmFor, confirmFieldId, resetConfirm: () => setChoice(undefined) };
}
