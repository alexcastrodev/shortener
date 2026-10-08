import type { ScheduleEventData } from '@mantine/schedule';
import type { AgendaSession } from '@internal/core/actions/get-agenda/get-agenda.types';
import type { MyBooking } from '@internal/core/actions/get-my-bookings/get-my-bookings.types';
import {
  DEFAULT_DURATION,
  categoryOf,
  clock,
  minutesOfDay,
  todayIn,
} from './agenda-layout.ts';

const DAY_END = 24 * 60 - 1;

export const keyOf = (session: AgendaSession) =>
  `${session.form_id}:${session.service_id}:${session.starts_at}`;

export function wallClock(date: string, minutes: number) {
  return `${date} ${clock(Math.min(minutes, DAY_END))}:00`;
}

export function localStart(session: AgendaSession, zone: string) {
  return wallClock(session.date, minutesOfDay(session.starts_at, zone));
}

export function sameMoment(a: string, b: string) {
  return a.replace('T', ' ').slice(0, 16) === b.replace('T', ' ').slice(0, 16);
}

export function toEvent(
  session: AgendaSession,
  zone: string,
  colors: Map<string, string>
): ScheduleEventData {
  const start = minutesOfDay(session.starts_at, zone);
  return {
    id: keyOf(session),
    title: session.service_name ?? '',
    start: wallClock(session.date, start),
    end: wallClock(
      session.date,
      start + (session.duration ?? DEFAULT_DURATION)
    ),
    color: colors.get(categoryOf(session)) ?? 'var(--color-primary)',
    payload: { session },
  };
}

export type MySlot = {
  key: string;
  booking: MyBooking;
  starts_at: string;
  status: string;
  date: string;
};

const HOLDING = ['confirmed', 'pending', 'unverified'];

export function mySlots(bookings: MyBooking[], zone: string): MySlot[] {
  return bookings.flatMap(booking =>
    booking.sessions
      .filter(session => HOLDING.includes(session.status))
      .map(session => ({
        key: `mine:${booking.group_key}:${session.starts_at}`,
        booking,
        starts_at: session.starts_at,
        status: session.status,
        date: todayIn(zone, new Date(session.starts_at)),
      }))
  );
}

export function slotEvent(slot: MySlot, zone: string): ScheduleEventData {
  const start = minutesOfDay(slot.starts_at, zone);
  return {
    id: slot.key,
    title: slot.booking.service,
    start: wallClock(slot.date, start),
    end: wallClock(slot.date, start + DEFAULT_DURATION),
    color: 'var(--color-foreground)',
    payload: { slot },
  };
}

export function targetFor(
  sessions: AgendaSession[],
  from: AgendaSession,
  start: string,
  zone: string
) {
  return (
    sessions.find(
      candidate =>
        candidate.form_id === from.form_id &&
        candidate.service_id === from.service_id &&
        sameMoment(localStart(candidate, zone), start)
    ) ?? null
  );
}
