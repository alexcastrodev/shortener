import type { BookingService } from '@internal/core/types/Form';
import { pad } from './monthly-booking.ts';

export const MAX_DAYS = 56;

export const isoDay = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const monthOf = (date: Date) => isoDay(date).slice(0, 7);

const firstOf = (month: string) => {
  const [year, number] = month.split('-').map(Number);
  return new Date(year, number - 1, 1);
};

export function shiftMonth(month: string, delta: number): string {
  const first = firstOf(month);
  return monthOf(new Date(first.getFullYear(), first.getMonth() + delta, 1));
}

export function lastBookable(today: Date): string {
  return isoDay(
    new Date(today.getFullYear(), today.getMonth(), today.getDate() + MAX_DAYS - 1)
  );
}

export function canGoPrev(month: string, today: Date): boolean {
  return month > monthOf(today);
}

export function canGoNext(month: string, today: Date): boolean {
  return `${shiftMonth(month, 1)}-01` <= lastBookable(today);
}

export function monthRange(
  month: string,
  today: Date
): { from: string; to: string } | null {
  const first = firstOf(month);
  const end = isoDay(new Date(first.getFullYear(), first.getMonth() + 1, 0));
  const start = isoDay(today);
  const limit = lastBookable(today);
  const from = `${month}-01` > start ? `${month}-01` : start;
  const to = end < limit ? end : limit;
  return from <= to ? { from, to } : null;
}

export function monthGrid(month: string): (string | null)[][] {
  const first = firstOf(month);
  const count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells: (string | null)[] = Array((first.getDay() + 6) % 7).fill(null);
  for (let day = 1; day <= count; day += 1) cells.push(`${month}-${pad(day)}`);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let index = 0; index < cells.length; index += 7)
    weeks.push(cells.slice(index, index + 7));
  return weeks;
}

export type DayCell = {
  enabled: boolean;
  time: string | undefined;
  viewed: boolean;
  today: boolean;
};

export function dayCell(
  iso: string,
  state: {
    available: Set<string>;
    chosen: Map<string, string>;
    viewed: string | undefined;
    todayIso: string;
  }
): DayCell {
  return {
    enabled: state.available.has(iso),
    time: state.chosen.get(iso),
    viewed: iso === state.viewed,
    today: iso === state.todayIso,
  };
}

export function keepFree<T extends { date: string; time: string }>(
  sessions: T[],
  slots: { date: string; time: string }[],
  range: { from: string; to: string }
): T[] {
  const free = new Set(slots.map(slot => `${slot.date}|${slot.time}`));
  return sessions.filter(
    session =>
      session.date < range.from ||
      session.date > range.to ||
      free.has(`${session.date}|${session.time}`)
  );
}

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export function previewSlots(
  service: Pick<BookingService, 'days' | 'times'> &
    Partial<Pick<BookingService, 'times_by_day' | 'capacity'>>,
  from: string,
  to: string,
  today: Date
): { starts_at: string; date: string; time: string; remaining: number }[] {
  const slots = [];
  const first = isoDay(today);
  const [year, month, day] = from.split('-').map(Number);
  for (let cursor = new Date(year, month - 1, day); isoDay(cursor) <= to; ) {
    const date = isoDay(cursor);
    const weekday = WEEKDAY_KEYS[cursor.getDay()];
    if (date > first && service.days.includes(weekday)) {
      const times = service.times_by_day?.[weekday] ?? service.times;
      for (const time of [...times].sort())
        slots.push({
          starts_at: `${date}T${time}:00`,
          date,
          time,
          remaining: service.capacity ?? 1,
        });
    }
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1);
  }
  return slots;
}
