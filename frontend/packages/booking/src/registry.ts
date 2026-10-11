import { individualMode } from './individual/index.ts';
import type { BookingMode } from './mode.ts';
import { servicesMode } from './services/index.ts';

export const modes: BookingMode[] = [servicesMode, individualMode];

export const modeFor = (name?: string): BookingMode =>
  modes.find(mode => mode.name === name) ?? servicesMode;
