import {
  IconAlignLeft,
  IconAt,
  IconCalendar,
  IconCalendarEvent,
  IconCircleDot,
  IconHash,
  IconHeading,
  IconPhoto,
  IconLetterT,
  IconSquareCheck,
  IconStar,
  IconToggleLeft,
  type Icon,
} from '@tabler/icons-react';
import type { FormFieldType } from '@internal/core/types/Form';
import i18n from '../../i18n';

export const FIELD_TYPES: FormFieldType[] = [
  'short_text',
  'long_text',
  'email',
  'number',
  'single_choice',
  'multiple_choice',
  'yes_no',
  'rating',
  'date',
  'image',
  'booking',
  'section',
];

const LABELS: Record<FormFieldType, () => string> = {
  short_text: () => i18n.t('forms:ed_type_short_text'),
  long_text: () => i18n.t('forms:ed_type_long_text'),
  email: () => i18n.t('forms:ed_type_email'),
  number: () => i18n.t('forms:ed_type_number'),
  single_choice: () => i18n.t('forms:ed_type_single_choice'),
  multiple_choice: () => i18n.t('forms:ed_type_multiple_choice'),
  yes_no: () => i18n.t('forms:ed_type_yes_no'),
  rating: () => i18n.t('forms:ed_type_rating'),
  date: () => i18n.t('forms:ed_type_date'),
  image: () => i18n.t('forms:ed_type_image'),
  booking: () => i18n.t('forms:ed_type_booking'),
  section: () => i18n.t('forms:ed_type_section'),
};

const HINTS: Record<FormFieldType, () => string> = {
  short_text: () => i18n.t('forms:ed_type_short_text_hint'),
  long_text: () => i18n.t('forms:ed_type_long_text_hint'),
  email: () => i18n.t('forms:ed_type_email_hint'),
  number: () => i18n.t('forms:ed_type_number_hint'),
  single_choice: () => i18n.t('forms:ed_type_single_choice_hint'),
  multiple_choice: () => i18n.t('forms:ed_type_multiple_choice_hint'),
  yes_no: () => i18n.t('forms:ed_type_yes_no_hint'),
  rating: () => i18n.t('forms:ed_type_rating_hint'),
  date: () => i18n.t('forms:ed_type_date_hint'),
  image: () => i18n.t('forms:ed_type_image_hint'),
  booking: () => i18n.t('forms:ed_type_booking_hint'),
  section: () => i18n.t('forms:ed_type_section_hint'),
};

export const fieldTypeLabel = (type: FormFieldType) => LABELS[type]();

export const fieldTypeHint = (type: FormFieldType) => HINTS[type]();

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
  image: IconPhoto,
  booking: IconCalendarEvent,
  section: IconHeading,
};
