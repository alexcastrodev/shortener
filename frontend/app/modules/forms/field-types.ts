import {
  IconAlignLeft,
  IconAt,
  IconCalendar,
  IconCircleDot,
  IconHash,
  IconHeading,
  IconLetterT,
  IconSquareCheck,
  IconStar,
  IconToggleLeft,
  type Icon,
} from '@tabler/icons-react';
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
  { type: 'section', label: 'Section', hint: 'A heading that groups questions' },
];

export function fieldTypeLabel(type: FormFieldType) {
  return FIELD_TYPES.find(item => item.type === type)?.label ?? type;
}

export const isSection = (field: { type: FormFieldType }) => field.type === 'section';

export function sectionOf(fields: { id: string; type: FormFieldType; label: string }[], id: string) {
  let title: string | undefined;
  for (const field of fields) {
    if (field.id === id) return title;
    if (isSection(field)) title = field.label;
  }
}

export function isChoiceType(type: FormFieldType) {
  return type === 'single_choice' || type === 'multiple_choice';
}

export const FIELD_ICONS: Record<FormFieldType, Icon> = {
  short_text: IconLetterT,
  long_text: IconAlignLeft,
  email: IconAt,
  number: IconHash,
  single_choice: IconCircleDot,
  multiple_choice: IconSquareCheck,
  yes_no: IconToggleLeft,
  rating: IconStar,
  date: IconCalendar,
  section: IconHeading,
};
