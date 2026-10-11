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

const DAY_START = '09:00';
const DAY_END = '18:00';

const isPreset = (minutes: number) =>
  (STEP_PRESETS as readonly number[]).includes(minutes);

export const stepFor = (
  duration: number
): Pick<GeneratorValues, 'step' | 'customStep'> =>
  isPreset(duration)
    ? { step: duration, customStep: '' }
    : { step: 'custom', customStep: duration };

export const generatorFor = (duration: number): GeneratorValues => ({
  from: DAY_START,
  to: DAY_END,
  ...stepFor(duration),
  lunch: false,
  lunchFrom: '12:00',
  lunchTo: '13:00',
});

const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const toTime = (total: number) =>
  `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;

export function defaultTimes(duration: number): string[] {
  if (!Number.isInteger(duration) || duration <= 0) return [];
  const times: string[] = [];
  for (
    let cursor = toMinutes(DAY_START);
    cursor + duration <= toMinutes(DAY_END);
    cursor += duration
  ) {
    times.push(toTime(cursor));
  }
  return times;
}

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
