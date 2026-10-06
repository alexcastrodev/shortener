import type { AgendaSession } from '@internal/core/actions/get-agenda/get-agenda.types';

export const HOUR_PX = 52;
export const MIN_BLOCK_PX = 26;
export const DEFAULT_DURATION = 60;

export type View = 'week' | 'day';

export type Block = {
  session: AgendaSession;
  top: number;
  height: number;
  lane: number;
  lanes: number;
};

const toUtc = (date: string) => {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

const fromUtc = (value: Date) => value.toISOString().slice(0, 10);

export function addDays(date: string, days: number) {
  const value = toUtc(date);
  value.setUTCDate(value.getUTCDate() + days);
  return fromUtc(value);
}

export function weekStart(date: string) {
  const offset = (toUtc(date).getUTCDay() + 6) % 7;
  return addDays(date, -offset);
}

export function rangeFor(view: View, anchor: string) {
  if (view === 'day') return { from: anchor, to: anchor, days: [anchor] };
  const from = weekStart(anchor);
  return {
    from,
    to: addDays(from, 6),
    days: Array.from({ length: 7 }, (_, index) => addDays(from, index)),
  };
}

export function step(view: View, anchor: string, direction: -1 | 1) {
  return addDays(anchor, (view === 'week' ? 7 : 1) * direction);
}

export function todayIn(timeZone: string, now: Date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function minutesOfDay(value: string | Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(typeof value === 'string' ? new Date(value) : value);
  const get = (type: string) =>
    Number(parts.find(part => part.type === type)?.value ?? 0);
  return get('hour') * 60 + get('minute');
}

export const clock = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

export function dayBlocks(
  sessions: AgendaSession[],
  timeZone: string
): Block[] {
  const items = sessions
    .map(session => {
      const start = minutesOfDay(session.starts_at, timeZone);
      const length = session.duration ?? DEFAULT_DURATION;
      return { session, start, end: start + length };
    })
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const placed: {
    item: (typeof items)[number];
    lane: number;
    cluster: number;
  }[] = [];
  const laneEnds: number[] = [];
  let cluster = 0;
  let clusterEnd = -1;
  for (const item of items) {
    if (item.start >= clusterEnd && laneEnds.every(end => end <= item.start)) {
      laneEnds.length = 0;
      cluster += 1;
    }
    let lane = laneEnds.findIndex(end => end <= item.start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = item.end;
    clusterEnd = Math.max(clusterEnd, item.end);
    placed.push({ item, lane, cluster });
  }
  const lanesIn = new Map<number, number>();
  for (const { lane, cluster: id } of placed)
    lanesIn.set(id, Math.max(lanesIn.get(id) ?? 0, lane + 1));

  return placed.map(({ item, lane, cluster: id }) => ({
    session: item.session,
    top: (item.start / 60) * HOUR_PX,
    height: Math.max(((item.end - item.start) / 60) * HOUR_PX, MIN_BLOCK_PX),
    lane,
    lanes: lanesIn.get(id) ?? 1,
  }));
}

export function sessionsByDay(
  sessions: AgendaSession[],
  formId: number | null
) {
  const byDay = new Map<string, AgendaSession[]>();
  for (const session of sessions) {
    if (formId !== null && session.form_id !== formId) continue;
    byDay.set(session.date, [...(byDay.get(session.date) ?? []), session]);
  }
  return byDay;
}

export function occupancy(session: AgendaSession) {
  return session.capacity === null
    ? { unlimited: true as const, booked: session.booked }
    : {
        unlimited: false as const,
        booked: session.booked,
        capacity: session.capacity,
      };
}

export function pendingTotal(sessions: AgendaSession[]) {
  return sessions.reduce((sum, session) => sum + session.pending, 0);
}

export function addMonths(date: string, months: number) {
  const [year, month, day] = date.split('-').map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const last = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
  ).getUTCDate();
  target.setUTCDate(Math.min(day, last));
  return fromUtc(target);
}

export function monthRange(anchor: string) {
  const from = weekStart(`${anchor.slice(0, 8)}01`);
  return { from, to: addDays(from, 41) };
}

export function monthDays(anchor: string) {
  const { from } = monthRange(anchor);
  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(from, index);
    return { date, inMonth: date.slice(0, 7) === anchor.slice(0, 7) };
  });
}

export function datesWithSessions(sessions: AgendaSession[]) {
  return new Set(sessions.map(session => session.date));
}

export const NO_CATEGORY = 'none';

export const categoryOf = (session: AgendaSession) =>
  session.category?.id ?? NO_CATEGORY;

export const PALETTE = [
  '#a78bfa',
  '#fb923c',
  '#2dd4bf',
  '#60a5fa',
  '#f472b6',
  '#facc15',
  '#4ade80',
  '#f87171',
];

export function categoryColors(sessions: AgendaSession[]) {
  const ids = [
    ...new Set(
      sessions.flatMap(session =>
        session.category ? [session.category.id] : []
      )
    ),
  ].sort();
  return new Map(ids.map((id, index) => [id, PALETTE[index % PALETTE.length]]));
}

export type Direction = 'left' | 'right' | 'up' | 'down';
export type NavBlock = { id: string; day: string; start: number; lane: number };

export function neighbour(
  blocks: NavBlock[],
  from: string,
  direction: Direction
) {
  const current = blocks.find(block => block.id === from);
  if (!current) return null;
  if (direction === 'up' || direction === 'down') {
    const column = blocks
      .filter(block => block.day === current.day)
      .sort((a, b) => a.start - b.start || a.lane - b.lane);
    const at = column.findIndex(block => block.id === from);
    return column[at + (direction === 'down' ? 1 : -1)]?.id ?? null;
  }
  const days = [...new Set(blocks.map(block => block.day))].sort();
  const day =
    days[days.indexOf(current.day) + (direction === 'right' ? 1 : -1)];
  if (!day) return null;
  return (
    blocks
      .filter(block => block.day === day)
      .sort(
        (a, b) =>
          Math.abs(a.start - current.start) -
            Math.abs(b.start - current.start) || a.lane - b.lane
      )[0]?.id ?? null
  );
}
