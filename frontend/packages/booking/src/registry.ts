import type { FormField } from '@internal/core/types/Form';
import { individualMode } from './individual/index.ts';
import type { BookingMode } from './mode.ts';
import { servicesMode } from './services/index.ts';
import type { Values } from './shared/values.ts';

export const modes: BookingMode[] = [servicesMode, individualMode];

export const modeFor = (name?: string): BookingMode =>
  modes.find(mode => mode.name === name) ?? servicesMode;

export const initialValues = (field?: FormField) =>
  modeFor(field?.mode).initialValues(field);

export const toBookingInput = (values: Values, creating: boolean) =>
  modeFor(values.mode).toBookingInput(values, creating);
