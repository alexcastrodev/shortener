import type { GenerateAppointmentTimesParams } from '@internal/core/actions/generate-appointment-times/generate-appointment-times.types';

export const STEP_PRESETS = [30, 60, 90, 120] as const;

export type GeneratorValues = {
  from: string;
  to: string;
  step: number | 'custom';
  customStep: number | '';
  lunch: boolean;
  lunchFrom: string;
  lunchTo: string;
};

export const defaultGenerator: GeneratorValues = {
  from: '09:00',
  to: '18:00',
  step: 60,
  customStep: '',
  lunch: true,
  lunchFrom: '12:00',
  lunchTo: '13:00',
};

export function toGenerateParams(
  values: GeneratorValues,
  duration: number
): GenerateAppointmentTimesParams | null {
  const step = values.step === 'custom' ? values.customStep : values.step;
  if (step === '') return null;
  return {
    from: values.from,
    to: values.to,
    step,
    duration,
    ...(values.lunch
      ? { lunch: { from: values.lunchFrom, to: values.lunchTo } }
      : {}),
  };
}
