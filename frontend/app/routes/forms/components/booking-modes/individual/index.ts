import { individualMode } from '@internal/booking';
import i18n from '../../../../../i18n';
import type { EditorMode } from '../editor-mode';
import { IndividualFlow } from './flow';
import { IndividualItemFields } from './item-fields';

export const individualEditor: EditorMode = {
  mode: individualMode,
  create: () => individualMode.newBooking(i18n.t('booking:lesson_default')),
  choice: t => ({
    label: t('ed_booking_mode_individual'),
    hint: t('ed_booking_mode_individual_hint'),
  }),
  words: t => ({
    unnamed: t('lesson_new'),
    remove: name => t('lesson_remove', { name }),
    removeTitle: t('lesson_remove_title'),
    removeBody: t('lesson_remove_body'),
    multiple: t('multiple_lessons'),
    multipleHint: t('multiple_lessons_hint'),
    multipleSummary: t('rules_sum_multiple_lessons'),
  }),
  Flow: IndividualFlow,
  ItemFields: IndividualItemFields,
};
