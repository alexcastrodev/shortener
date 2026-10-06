export type Unit = 'minutes' | 'hours' | 'days';

export const UNIT_MINUTES: Record<Unit, number> = {
  minutes: 1,
  hours: 60,
  days: 1440,
};

export const MIN_TIMEOUT = 5;
export const MAX_TIMEOUT = 43200;

export function splitMinutes(minutes: number): { amount: number; unit: Unit } {
  if (minutes >= 1440 && minutes % 1440 === 0)
    return { amount: minutes / 1440, unit: 'days' };
  if (minutes >= 60 && minutes % 60 === 0)
    return { amount: minutes / 60, unit: 'hours' };
  return { amount: minutes, unit: 'minutes' };
}

export function joinMinutes(amount: number | '', unit: Unit) {
  return amount === '' ? '' : Math.round(amount * UNIT_MINUTES[unit]);
}

export function timeoutInRange(minutes: number | '') {
  return (
    minutes !== '' &&
    Number.isInteger(minutes) &&
    minutes >= MIN_TIMEOUT &&
    minutes <= MAX_TIMEOUT
  );
}
