import type { FormField, FormFieldInput } from '@internal/core/types/Form';
import type { ModeValidation } from './shared/validation.ts';
import type { ServiceValues, Values } from './shared/values.ts';

export type ModeName = 'services' | 'individual';

export type BookingMode = {
  name: ModeName;
  validation: ModeValidation;
  initialValues: (field?: FormField) => Values;
  newBooking: (firstItemName: string) => FormFieldInput;
  blankItem: (values: Values, name: string) => ServiceValues;
  toBookingInput: (values: Values, creating: boolean) => FormFieldInput;
  compile: (field: FormField) => FormField;
  scheduled: (service: ServiceValues) => boolean;
  groupOf: (values: Values, service: ServiceValues) => string | undefined;
};
