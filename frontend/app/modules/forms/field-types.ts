import type { FormFieldType } from '@internal/core/types/Form';

export const FIELD_TYPES: { type: FormFieldType; label: string; hint: string }[] = [
  { type: 'short_text', label: 'Short text', hint: 'A single line' },
  { type: 'long_text', label: 'Long text', hint: 'A paragraph' },
  { type: 'email', label: 'E-mail', hint: 'An e-mail address' },
  { type: 'number', label: 'Number', hint: 'Optional min and max' },
  { type: 'single_choice', label: 'Single choice', hint: 'Pick one option' },
  { type: 'multiple_choice', label: 'Multiple choice', hint: 'Pick several options' },
  { type: 'yes_no', label: 'Yes / No', hint: 'Two answers' },
  { type: 'rating', label: 'Rating', hint: '1 to 5 or 1 to 10' },
  { type: 'date', label: 'Date', hint: 'A calendar date' },
];

export function fieldTypeLabel(type: FormFieldType) {
  return FIELD_TYPES.find(item => item.type === type)?.label ?? type;
}

export function isChoiceType(type: FormFieldType) {
  return type === 'single_choice' || type === 'multiple_choice';
}
