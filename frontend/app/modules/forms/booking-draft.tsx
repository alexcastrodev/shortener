import { createContext, useContext } from 'react';
import type {
  BookingService,
  FormField,
  FormFieldInput,
} from '@internal/core/types/Form';

export type BookingDraft = {
  fieldId: string;
  input: FormFieldInput;
  openIndex: number;
};

export const BookingDraftContext = createContext<(draft: BookingDraft | null) => void>(
  () => {}
);

export const useBookingDraft = () => useContext(BookingDraftContext);

export function applyBookingDraft(
  fields: FormField[],
  draft: BookingDraft | null
): { fields: FormField[]; serviceId?: string } {
  if (!draft) return { fields };
  const services = (draft.input.services ?? []).map(
    (service, index): BookingService => ({
      ...service,
      id: service.id ?? `draft-${index}`,
    })
  );
  return {
    fields: fields.map(field =>
      field.id === draft.fieldId
        ? {
            ...field,
            label: draft.input.label || field.label,
            help: draft.input.help ?? undefined,
            categories: draft.input.categories ?? field.categories,
            services,
          }
        : field
    ),
    serviceId: services[draft.openIndex]?.id,
  };
}
