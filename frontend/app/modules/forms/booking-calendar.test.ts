import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  canGoNext,
  canGoPrev,
  dayCell,
  keepFree,
  lastBookable,
  monthGrid,
  monthRange,
  previewSlots,
  shiftMonth,
} from './booking-calendar.ts';

test('the grid starts on Monday and pads whole weeks', () => {
  const weeks = monthGrid('2026-10');
  assert.equal(weeks.length, 5);
  assert.ok(weeks.every(week => week.length === 7));
  assert.deepEqual(weeks[0], [null, null, null, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
  assert.deepEqual(weeks[4].slice(3, 6), ['2026-10-29', '2026-10-30', '2026-10-31']);
  assert.equal(monthGrid('2026-06')[0][0], '2026-06-01');
  assert.equal(monthGrid('2027-02').length, 4);
  assert.equal(monthGrid('2027-01').length, 5);
  assert.equal(monthGrid('2026-08').length, 6);
});

test('months shift across a year end', () => {
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
  assert.equal(shiftMonth('2027-01', -1), '2026-12');
});

test('the loadable window is 56 days from today', () => {
  assert.equal(lastBookable(new Date(2026, 9, 8)), '2026-12-02');
  assert.equal(lastBookable(new Date(2026, 11, 20)), '2027-02-13');
});

test('a month range is clipped to the window', () => {
  const today = new Date(2026, 9, 8);
  assert.deepEqual(monthRange('2026-10', today), { from: '2026-10-08', to: '2026-10-31' });
  assert.deepEqual(monthRange('2026-11', today), { from: '2026-11-01', to: '2026-11-30' });
  assert.deepEqual(monthRange('2026-12', today), { from: '2026-12-01', to: '2026-12-02' });
  assert.equal(monthRange('2027-01', today), null);
  assert.equal(monthRange('2026-09', today), null);
});

test('navigation stops at the current month and the window end', () => {
  const today = new Date(2026, 9, 8);
  assert.equal(canGoPrev('2026-10', today), false);
  assert.equal(canGoPrev('2026-11', today), true);
  assert.equal(canGoNext('2026-11', today), true);
  assert.equal(canGoNext('2026-12', today), false);
  assert.equal(canGoNext('2026-11', new Date(2026, 9, 5)), false);
});

test('a day cell tells free, chosen, viewed and today apart', () => {
  const state = {
    available: new Set(['2026-10-12', '2026-10-13']),
    chosen: new Map([['2026-10-13', '16:30']]),
    viewed: '2026-10-12',
    todayIso: '2026-10-09',
  };
  assert.deepEqual(dayCell('2026-10-12', state), { enabled: true, time: undefined, viewed: true, today: false });
  assert.deepEqual(dayCell('2026-10-13', state), { enabled: true, time: '16:30', viewed: false, today: false });
  assert.deepEqual(dayCell('2026-10-09', state), { enabled: false, time: undefined, viewed: false, today: true });
});

test('only sessions inside the loaded range can be dropped', () => {
  const range = { from: '2026-10-08', to: '2026-10-31' };
  const slots = [{ date: '2026-10-12', time: '09:00' }];
  const sessions = [
    { date: '2026-10-12', time: '09:00' },
    { date: '2026-10-13', time: '09:00' },
    { date: '2026-11-03', time: '10:00' },
  ];
  assert.deepEqual(keepFree(sessions, slots, range), [sessions[0], sessions[2]]);
});

test('preview slots follow weekdays, per-day times and start tomorrow', () => {
  const today = new Date(2026, 9, 8);
  const service = {
    days: ['mon', 'fri'],
    times: ['10:00', '09:00'],
    times_by_day: { fri: ['15:00'] },
    capacity: 3,
  };
  const slots = previewSlots(service, '2026-10-08', '2026-10-19', today);
  assert.deepEqual(
    slots.map(slot => `${slot.date} ${slot.time}`),
    ['2026-10-09 15:00', '2026-10-12 09:00', '2026-10-12 10:00', '2026-10-16 15:00', '2026-10-19 09:00', '2026-10-19 10:00']
  );
  assert.equal(slots[0].remaining, 3);
});

test('preview slots are empty without days or times and clip to the range', () => {
  const today = new Date(2026, 9, 8);
  const all = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  assert.deepEqual(previewSlots({ days: [], times: ['09:00'] }, '2026-10-08', '2026-10-31', today), []);
  assert.deepEqual(previewSlots({ days: all, times: [] }, '2026-10-08', '2026-10-31', today), []);
  const clipped = previewSlots({ days: all, times: ['09:00'] }, '2026-10-10', '2026-10-11', today);
  assert.deepEqual(clipped.map(slot => slot.date), ['2026-10-10', '2026-10-11']);
  assert.equal(clipped[0].remaining, 1);
});
