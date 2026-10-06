import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AgendaSession } from '@internal/core/actions/get-agenda/get-agenda.types';
import {
  HOUR_PX,
  MIN_BLOCK_PX,
  addDays,
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

test('pending requests are summed', () => {
  assert.equal(
    pendingTotal([
      session('2026-11-02T09:00:00Z', { pending: 2 }),
      session('2026-11-02T10:00:00Z', { pending: 1 }),
    ]),
    3
  );
});
