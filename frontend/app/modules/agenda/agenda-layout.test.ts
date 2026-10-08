import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AgendaSession } from '@internal/core/actions/get-agenda/get-agenda.types';
import {
  HOUR_PX,
  MIN_BLOCK_PX,
  NO_CATEGORY,
  PALETTE,
  addDays,
  addMonths,
  categoryColors,
  canReceive,
  cascadeSpan,
  categoryOf,
  datesWithSessions,
  monthDays,
  monthRange,
  neighbour,
  clock,
  dayBlocks,
  minutesOfDay,
  pendingTotal,
  rangeFor,
  sessionsByDay,
  step,
  todayIn,
  weekStart,
} from './agenda-layout.ts';
import {
  mySlots,
  sameMoment,
  slotEvent,
  targetFor,
  toEvent,
} from './schedule-events.ts';

const session = (
  startsAt: string,
  extra: Partial<AgendaSession> = {}
): AgendaSession => ({
  form_id: 1,
  form_title: 'Salon',
  service_id: 'svc00001',
  service_name: 'Haircut',
  duration: 60,
  starts_at: startsAt,
  date: startsAt.slice(0, 10),
  capacity: 2,
  booked: 0,
  pending: 0,
  appointments: [],
  ...extra,
});

test('a week starts on Monday and covers seven days, across month and year ends', () => {
  assert.equal(weekStart('2026-10-07'), '2026-10-05');
  assert.equal(weekStart('2026-10-11'), '2026-10-05');
  assert.equal(weekStart('2026-10-05'), '2026-10-05');
  assert.deepEqual(rangeFor('week', '2026-12-31').days, [
    '2026-12-28',
    '2026-12-29',
    '2026-12-30',
    '2026-12-31',
    '2027-01-01',
    '2027-01-02',
    '2027-01-03',
  ]);
  assert.deepEqual(rangeFor('day', '2026-10-07'), {
    from: '2026-10-07',
    to: '2026-10-07',
    days: ['2026-10-07'],
  });
});

test('stepping moves a week or a day', () => {
  assert.equal(step('week', '2026-10-07', 1), '2026-10-14');
  assert.equal(step('day', '2026-10-07', -1), '2026-10-06');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
});

test('the time of day is read in the owner time zone, including daylight saving', () => {
  assert.equal(minutesOfDay('2026-07-01T09:00:00Z', 'Europe/Lisbon'), 10 * 60);
  assert.equal(minutesOfDay('2026-01-01T09:00:00Z', 'Europe/Lisbon'), 9 * 60);
  assert.equal(
    minutesOfDay('2026-11-02T20:30:00Z', 'Pacific/Auckland'),
    9 * 60 + 30
  );
  assert.equal(clock(9 * 60 + 5), '09:05');
});

test('today is the owner calendar day, not the browser one', () => {
  const now = new Date('2026-11-02T20:00:00Z');
  assert.equal(todayIn('UTC', now), '2026-11-02');
  assert.equal(todayIn('Pacific/Auckland', now), '2026-11-03');
});

test('a block sits at its start with the height of its length, never under the minimum', () => {
  const [block] = dayBlocks(
    [session('2026-11-02T10:00:00Z', { duration: 90 })],
    'UTC'
  );
  assert.equal(block.top, 10 * HOUR_PX);
  assert.equal(block.height, 1.5 * HOUR_PX);
  const [short] = dayBlocks(
    [session('2026-11-02T10:00:00Z', { duration: 5 })],
    'UTC'
  );
  assert.equal(short.height, MIN_BLOCK_PX);
  const [unknown] = dayBlocks(
    [session('2026-11-02T10:00:00Z', { duration: null })],
    'UTC'
  );
  assert.equal(unknown.height, HOUR_PX);
});

test('sessions that overlap share the width, and separate ones do not', () => {
  const blocks = dayBlocks(
    [
      session('2026-11-02T09:00:00Z'),
      session('2026-11-02T09:30:00Z', { service_id: 'svc00002' }),
      session('2026-11-02T12:00:00Z'),
    ],
    'UTC'
  );
  assert.deepEqual(
    blocks.map(block => [block.lane, block.lanes]),
    [
      [0, 2],
      [1, 2],
      [0, 1],
    ]
  );
});

test('back to back sessions do not overlap', () => {
  const blocks = dayBlocks(
    [session('2026-11-02T09:00:00Z'), session('2026-11-02T10:00:00Z')],
    'UTC'
  );
  assert.deepEqual(
    blocks.map(block => [block.lane, block.lanes]),
    [
      [0, 1],
      [0, 1],
    ]
  );
});

test('sessions are grouped by their local day and can be filtered by form', () => {
  const list = [
    session('2026-11-02T09:00:00Z'),
    session('2026-11-02T11:00:00Z', { form_id: 2 }),
    session('2026-11-03T09:00:00Z'),
  ];
  assert.equal(sessionsByDay(list, null).get('2026-11-02')?.length, 2);
  assert.equal(sessionsByDay(list, 2).get('2026-11-02')?.length, 1);
  assert.equal(sessionsByDay(list, 2).has('2026-11-03'), false);
});

test('the month grid starts on a Monday, spans six weeks and flags the month', () => {
  const days = monthDays('2026-10-06');
  assert.equal(days.length, 42);
  assert.equal(days[0].date, '2026-09-28');
  assert.equal(days[0].inMonth, false);
  assert.equal(days[3].date, '2026-10-01');
  assert.equal(days[3].inMonth, true);
  assert.deepEqual(monthRange('2026-10-06'), {
    from: '2026-09-28',
    to: '2026-11-08',
  });
});

test('adding months clamps the day and crosses years', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2026-12-15', 1), '2027-01-15');
  assert.equal(addMonths('2026-01-15', -1), '2025-12-15');
});

test('categories get stable colours by id and sessions without one are grouped', () => {
  const sessions = [
    session('2026-10-06T09:00:00Z', { category: { id: 'b', name: 'B' } }),
    session('2026-10-06T10:00:00Z', { category: { id: 'a', name: 'A' } }),
    session('2026-10-06T11:00:00Z'),
  ];
  const colors = categoryColors(sessions);
  assert.equal(colors.get('a'), PALETTE[0]);
  assert.equal(colors.get('b'), PALETTE[1]);
  assert.equal(categoryOf(sessions[2]), NO_CATEGORY);
  assert.deepEqual([...datesWithSessions(sessions)], ['2026-10-06']);
});

test('arrow navigation walks blocks by day and time', () => {
  const blocks = [
    { id: 'a', day: '2026-10-05', start: 540, lane: 0 },
    { id: 'b', day: '2026-10-05', start: 600, lane: 0 },
    { id: 'c', day: '2026-10-06', start: 570, lane: 0 },
    { id: 'd', day: '2026-10-06', start: 900, lane: 0 },
    { id: 'e', day: '2026-10-08', start: 600, lane: 0 },
  ];
  assert.equal(neighbour(blocks, 'a', 'down'), 'b');
  assert.equal(neighbour(blocks, 'a', 'up'), null);
  assert.equal(neighbour(blocks, 'b', 'right'), 'c');
  assert.equal(neighbour(blocks, 'd', 'right'), 'e');
  assert.equal(neighbour(blocks, 'e', 'left'), 'c');
  assert.equal(neighbour(blocks, 'e', 'right'), null);
});

test('pending requests are summed', () => {
  assert.equal(
    pendingTotal([
      session('2026-11-02T09:00:00Z', { pending: 2 }),
      session('2026-11-02T10:00:00Z', { pending: 1 }),
    ]),
    3
  );
});

test('cascadeSpan: a lone block fills the column', () => {
  assert.deepEqual(cascadeSpan(0, 1), { left: 0, width: 100 });
});

test('cascadeSpan: each lane is indented and reaches the right edge', () => {
  assert.deepEqual(cascadeSpan(0, 2), { left: 0, width: 100 });
  assert.deepEqual(cascadeSpan(1, 2), { left: 16, width: 84 });
});

test('cascadeSpan: the top block keeps at least 60% however many overlap', () => {
  for (const lanes of [3, 5, 12, 40]) {
    const { width } = cascadeSpan(lanes - 1, lanes);
    assert.ok(width >= 60 - 1e-9, `${lanes} lanes -> ${width}`);
  }
});

test('canReceive: same service, other time, in the future, with room', () => {
  const from = session('2030-01-02T10:00:00Z', { booked: 1 });
  const now = new Date('2029-12-31T00:00:00Z');
  const target = session('2030-01-03T10:00:00Z');
  assert.equal(canReceive(from, 1, target, now), true);
  assert.equal(canReceive(from, 3, target, now), false);
  assert.equal(canReceive(from, 0, target, now), false);
  assert.equal(canReceive(from, 1, from, now), false);
  assert.equal(
    canReceive(from, 1, { ...target, service_id: 'other' }, now),
    false
  );
  assert.equal(canReceive(from, 1, { ...target, form_id: 2 }, now), false);
  assert.equal(canReceive(from, 1, { ...target, booked: 2 }, now), false);
  assert.equal(
    canReceive(from, 1, { ...target, capacity: null, booked: 9 }, now),
    true
  );
  assert.equal(
    canReceive(from, 1, session('2029-12-30T10:00:00Z'), now),
    false
  );
});

test('schedule events use the wall clock of the agenda time zone', () => {
  const lisbon = session('2026-10-07T08:30:00Z', { duration: 45 });
  const event = toEvent(lisbon, 'Europe/Lisbon', new Map());
  assert.equal(event.start, '2026-10-07 09:30:00');
  assert.equal(event.end, '2026-10-07 10:15:00');
  assert.equal(sameMoment('2026-10-07T09:30:00', '2026-10-07 09:30:00'), true);
  assert.equal(
    targetFor(
      [lisbon],
      session('2026-10-08T08:30:00Z'),
      '2026-10-07 09:30:00',
      'Europe/Lisbon'
    ),
    lisbon
  );
  assert.equal(
    targetFor(
      [lisbon],
      session('2026-10-08T08:30:00Z', { service_id: 'x' }),
      '2026-10-07 09:30:00',
      'Europe/Lisbon'
    ),
    null
  );
});

test('the month view covers six weeks starting on a Monday and steps by month', () => {
  const range = rangeFor('month', '2026-10-07');
  assert.equal(range.days.length, 42);
  assert.equal(range.from, '2026-09-28');
  assert.equal(range.to, '2026-11-08');
  assert.equal(step('month', '2026-10-31', 1), '2026-11-30');
  assert.equal(step('month', '2026-03-31', -1), '2026-02-28');
});

test('my bookings become one slot per session that still holds time', () => {
  const booking = {
    group_key: 'g1',
    form_title: 'Studio',
    service: 'Yoga',
    status: 'confirmed',
    cancellable: true,
    series: true,
    time_zone: 'America/New_York',
    sessions: [
      { starts_at: '2026-10-07T23:30:00Z', status: 'confirmed' },
      { starts_at: '2026-10-14T23:30:00Z', status: 'pending' },
      { starts_at: '2026-10-21T23:30:00Z', status: 'cancelled' },
      { starts_at: '2026-10-28T23:30:00Z', status: 'declined' },
      { starts_at: '2026-11-04T23:30:00Z', status: 'expired' },
      { starts_at: '2026-11-11T23:30:00Z', status: 'unverified' },
    ],
  };
  const slots = mySlots([booking], 'Europe/Lisbon');
  assert.deepEqual(
    slots.map(slot => [slot.date, slot.status]),
    [
      ['2026-10-08', 'confirmed'],
      ['2026-10-15', 'pending'],
      ['2026-11-11', 'unverified'],
    ]
  );
  const event = slotEvent(slots[0], 'Europe/Lisbon');
  assert.equal(event.start, '2026-10-08 00:30:00');
  assert.equal(event.end, '2026-10-08 01:30:00');
  assert.equal(event.id, 'mine:g1:2026-10-07T23:30:00Z');
  assert.equal(event.title, 'Yoga');
  assert.notEqual(
    event.id,
    toEvent(session('2026-10-07T23:30:00Z'), 'Europe/Lisbon', new Map()).id
  );
});
