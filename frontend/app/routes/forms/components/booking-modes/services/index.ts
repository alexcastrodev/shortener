import { servicesMode } from '@internal/booking';
import i18n from '../../../../../i18n';
import type { EditorMode } from '../editor-mode';
import { ServicesFlow } from './flow';
import { ServicesItemFields } from './item-fields';
import { WaitlistRules } from './waitlist-rules';

export const servicesEditor: EditorMode = {
  mode: servicesMode,
  create: () => servicesMode.newBooking(i18n.t('booking:service_default')),
  choice: t => ({
    label: t('ed_booking_mode_services'),
    hint: t('ed_booking_mode_services_hint'),
  }),
  words: t => ({
    unnamed: t('service_new'),
    remove: name => t('service_remove', { name }),
    removeTitle: t('service_remove_title'),
    removeBody: t('service_remove_body'),
  }),
  Flow: ServicesFlow,
  ItemFields: ServicesItemFields,
  RulesExtras: WaitlistRules,
};
