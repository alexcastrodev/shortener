import type { ScheduleEventData } from '@mantine/schedule';
import type { AgendaSession } from '@internal/core/actions/get-agenda/get-agenda.types';
import {
  DEFAULT_DURATION,
  categoryOf,
  clock,
  minutesOfDay,
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
