import type { FormField } from '@internal/core/types/Form';
import { pad } from './monthly-booking.ts';

export type Wall = { date: string; time: string };

type Timed = { starts_at: string; date: string; time: string };

export type Viewed<T extends Timed> = T & { viewDate: string; viewTime: string };

const MINUTE = 60_000;
const DAY = 86_400_000;

export const ZONE_KEY = 'kurz.view-zone';

const formatters = new Map<string, Intl.DateTimeFormat>();

function wallOf(ms: number, zone: string) {
  let formatter = formatters.get(zone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    formatters.set(zone, formatter);
  }
  const parts: Record<string, number> = {};
  for (const part of formatter.formatToParts(ms))
    if (part.type !== 'literal') parts[part.type] = Number(part.value);
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour % 24,
    minute: parts.minute,
  };
}

export function partsIn(instant: Date | number | string, zone: string): Wall {
  const wall = wallOf(new Date(instant).getTime(), zone);
  return {
    date: `${wall.year}-${pad(wall.month)}-${pad(wall.day)}`,
    time: `${pad(wall.hour)}:${pad(wall.minute)}`,
  };
}

export function offsetMinutes(zone: string, ms: number): number {
  const wall = wallOf(ms, zone);
  return (
    (Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute) -
      Math.floor(ms / MINUTE) * MINUTE) /
    MINUTE
  );
}

export function instantOf(date: string, time: string, zone: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const before = offsetMinutes(zone, wall - DAY);
  const after = offsetMinutes(zone, wall + DAY);
  const fits = [...new Set([before, after])]
    .map(offset => wall - offset * MINUTE)
    .filter(ms => offsetMinutes(zone, ms) === (wall - ms) / MINUTE);
  return new Date(fits.length ? Math.min(...fits) : wall - before * MINUTE);
}

export function convertWall(wall: Wall, from?: string, to?: string): Wall {
  if (!from || !to || from === to) return { date: wall.date, time: wall.time };
  return partsIn(instantOf(wall.date, wall.time, from), to);
}

export function localToday(zone: string | undefined, now = new Date()): Date {
  if (!zone) return now;
  const [year, month, day] = partsIn(now, zone).date.split('-').map(Number);
  return new Date(year, month - 1, day);
}

const shiftDay = (iso: string, days: number) => {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export function marginDays(
  formZone: string,
  viewZone: string,
  range: { from: string; to: string }
): number {
  const gap = (iso: string) => {
    const ms = Date.parse(`${iso}T12:00:00Z`);
    return Math.abs(offsetMinutes(viewZone, ms) - offsetMinutes(formZone, ms));
  };
  const widest = Math.max(gap(range.from), gap(range.to));
  return Math.max(1, Math.ceil((widest + 60) / 1440));
}

export function requestRange(
  range: { from: string; to: string },
  formZone?: string,
  viewZone?: string
): { from: string; to: string } {
  if (!formZone || !viewZone || formZone === viewZone) return range;
  const margin = marginDays(formZone, viewZone, range);
  return { from: shiftDay(range.from, -margin), to: shiftDay(range.to, margin) };
}

export function groupByViewDay<T extends Timed>(
  slots: T[],
  formZone?: string,
  viewZone?: string
): Map<string, Viewed<T>[]> {
  const seen = new Set<string>();
  const days = new Map<string, Viewed<T>[]>();
  for (const slot of slots) {
    if (seen.has(slot.starts_at)) continue;
    seen.add(slot.starts_at);
    const view =
      formZone && viewZone && formZone !== viewZone
        ? partsIn(slot.starts_at, viewZone)
        : { date: slot.date, time: slot.time };
    days.set(view.date, [
      ...(days.get(view.date) ?? []),
      { ...slot, viewDate: view.date, viewTime: view.time },
    ]);
  }
  for (const list of days.values())
    list.sort((a, b) => a.viewTime.localeCompare(b.viewTime));
  return days;
}

export const distinct = <T extends { starts_at: string }>(items: T[]): T[] => [
  ...new Map(items.map(item => [item.starts_at, item])).values(),
];

export const browserZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export const bookingZone = (fields: FormField[]): string | undefined => {
  const booking = fields.find(field => field.type === 'booking');
  return booking?.time_zone ?? booking?.rules?.time_zone;
};

export function isZone(value: unknown): value is string {
  if (typeof value !== 'string' || value === '') return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function readZone(
  storage: Pick<Storage, 'getItem'> | undefined
): string | undefined {
  try {
    const stored = storage?.getItem(ZONE_KEY);
    return isZone(stored) ? stored : undefined;
  } catch {
    return undefined;
  }
}

export function saveZone(
  storage: Pick<Storage, 'setItem'> | undefined,
  zone: string
) {
  try {
    storage?.setItem(ZONE_KEY, zone);
  } catch {
    return;
  }
}

export type ZoneChoice = { value: string; mine: boolean };

export function zoneChoices(
  formZone: string,
  mine: string | undefined,
  all: string[]
): ZoneChoice[] {
  const head: ZoneChoice[] = [
    ...(mine && mine !== formZone ? [{ value: mine, mine: true }] : []),
    { value: formZone, mine: false },
  ];
  const taken = new Set(head.map(choice => choice.value));
  return [
    ...head,
    ...all.filter(zone => !taken.has(zone)).map(value => ({ value, mine: false })),
  ];
}
