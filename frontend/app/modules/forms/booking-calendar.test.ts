import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  canGoNext,
  canGoPrev,
  dayCell,
  keepFree,
  lastBookable,
  monthGrid,
  monthlyClash,
  monthRange,
  mondayOf,
  previewSlots,
  shiftMonth,
  toggleSession,
  bufferOf,
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
    chosen: new Map([['2026-10-13', ['11:00', '16:30']]]),
    viewed: '2026-10-12',
    todayIso: '2026-10-09',
  };
  assert.deepEqual(dayCell('2026-10-12', state), { enabled: true, times: [], viewed: true, today: false });
  assert.deepEqual(dayCell('2026-10-13', state), { enabled: true, times: ['11:00', '16:30'], viewed: false, today: false });
  assert.deepEqual(dayCell('2026-10-09', state), { enabled: false, times: [], viewed: false, today: true });
});

const at = (date: string, time: string, duration = 60) => ({ date, time, duration });

test('picking two times on the same day keeps both, in order', () => {
  const first = toggleSession([], at('2026-10-13', '14:00'));
  assert.equal(first.kind, 'saved');
  const second = toggleSession(first.sessions, at('2026-10-13', '11:00'));
  assert.equal(second.kind, 'saved');
  assert.deepEqual(second.sessions, [at('2026-10-13', '11:00'), at('2026-10-13', '14:00')]);
});

test('picking a time again removes only that session', () => {
  const sessions = [at('2026-10-13', '11:00'), at('2026-10-13', '14:00'), at('2026-10-14', '09:00')];
  const result = toggleSession(sessions, at('2026-10-13', '11:00'));
  assert.equal(result.kind, 'removed');
  assert.deepEqual(result.sessions, [at('2026-10-13', '14:00'), at('2026-10-14', '09:00')]);
});

test('the same time with another duration replaces the session instead of adding a second one', () => {
  const result = toggleSession([at('2026-10-13', '11:00', 60)], at('2026-10-13', '11:00', 90));
  assert.equal(result.kind, 'saved');
  assert.deepEqual(result.sessions, [at('2026-10-13', '11:00', 90)]);
});

test('a time that overlaps a session of the same day is refused and says which one', () => {
  const sessions = [at('2026-10-13', '11:00', 60)];
  const inside = toggleSession(sessions, at('2026-10-13', '11:30', 30));
  assert.equal(inside.kind, 'overlap');
  assert.deepEqual(inside.sessions, sessions);
  assert.deepEqual(inside.clash, sessions[0]);
  assert.equal(toggleSession(sessions, at('2026-10-13', '10:30', 60)).kind, 'overlap');
  assert.equal(toggleSession(sessions, at('2026-10-14', '11:30', 60)).kind, 'saved');
});

test('sessions of other services block overlapping times, and are never removed from here', () => {
  const own = [at('2026-10-13', '09:00')];
  const others = [{ ...at('2026-10-13', '14:00'), service: 'Bateria' }];
  const clash = toggleSession(own, at('2026-10-13', '14:30', 30), 0, others);
  assert.equal(clash.kind, 'overlap');
  assert.deepEqual(clash.kind === 'overlap' && clash.clash, others[0]);
  assert.deepEqual(clash.sessions, own);
  const same = toggleSession(own, at('2026-10-13', '14:00'), 0, others);
  assert.equal(same.kind, 'overlap');
  assert.equal(toggleSession(own, at('2026-10-13', '15:00'), 0, others).kind, 'saved');
  assert.equal(toggleSession(own, at('2026-10-13', '15:00'), 30, others).kind, 'overlap');
  const removed = toggleSession(own, at('2026-10-13', '09:00'), 0, others);
  assert.equal(removed.kind, 'removed');
  assert.deepEqual(removed.sessions, []);
});

test('back to back is fine, and the buffer between sessions counts', () => {
  const sessions = [at('2026-10-13', '11:00', 60)];
  assert.equal(toggleSession(sessions, at('2026-10-13', '12:00', 60), 0).kind, 'saved');
  assert.equal(toggleSession(sessions, at('2026-10-13', '10:00', 60), 0).kind, 'saved');
  assert.equal(toggleSession(sessions, at('2026-10-13', '12:00', 60), 15).kind, 'overlap');
  assert.equal(toggleSession(sessions, at('2026-10-13', '12:15', 60), 15).kind, 'saved');
});

test('a week runs from Monday to Sunday', () => {
  assert.equal(mondayOf('2026-11-02'), '2026-11-02');
  assert.equal(mondayOf('2026-11-08'), '2026-11-02');
  assert.equal(mondayOf('2026-11-09'), '2026-11-09');
  assert.equal(mondayOf('2026-11-01'), '2026-10-26');
  assert.equal(mondayOf('2027-01-01'), '2026-12-28');
});

test('with an allowance per month the next pick is refused once the places are taken', () => {
  const cap = { limit: 2, per: 'month' as const };
  const first = toggleSession([], at('2026-11-03', '09:00'), 0, [], cap);
  assert.equal(first.kind, 'saved');
  const second = toggleSession(first.sessions, at('2026-11-17', '10:00'), 0, [], cap);
  assert.equal(second.kind, 'saved');
  const third = toggleSession(second.sessions, at('2026-11-24', '09:00'), 0, [], cap);
  assert.equal(third.kind, 'limit');
  assert.deepEqual(third.sessions, second.sessions);
  assert.equal(third.kind === 'limit' && third.per, 'month');
});

test('with an allowance a second time on the same day counts as another session', () => {
  const cap = { limit: 2, per: 'month' as const };
  const sessions = [at('2026-11-03', '09:00'), at('2026-11-03', '11:00')];
  assert.equal(toggleSession(sessions, at('2026-11-03', '14:00'), 0, [], cap).kind, 'limit');
});

test('removing a session frees a place, and a pick that only changes the duration does not take one', () => {
  const cap = { limit: 2, per: 'month' as const };
  const full = [at('2026-11-03', '09:00'), at('2026-11-17', '10:00')];
  const removed = toggleSession(full, at('2026-11-03', '09:00'), 0, [], cap);
  assert.equal(removed.kind, 'removed');
  assert.equal(toggleSession(removed.sessions, at('2026-11-24', '09:00'), 0, [], cap).kind, 'saved');
  const longer = toggleSession(full, at('2026-11-03', '09:00', 90), 0, [], cap);
  assert.equal(longer.kind, 'saved');
  assert.deepEqual(longer.sessions, [at('2026-11-03', '09:00', 90), at('2026-11-17', '10:00')]);
});

test('with an allowance per week the cap counts each Monday to Sunday week on its own', () => {
  const cap = { limit: 1, per: 'week' as const };
  const monday = [at('2026-11-02', '09:00')];
  const sameWeek = toggleSession(monday, at('2026-11-08', '09:00'), 0, [], cap);
  assert.equal(sameWeek.kind, 'limit');
  assert.equal(sameWeek.kind === 'limit' && sameWeek.per, 'week');
  assert.equal(toggleSession(monday, at('2026-11-09', '09:00'), 0, [], cap).kind, 'saved');
  assert.equal(toggleSession(monday, at('2026-11-16', '09:00'), 0, [], cap).kind, 'saved');
});

test('a weekly allowance of two keeps the third pick of a week out, and a week with a place left takes it', () => {
  const cap = { limit: 2, per: 'week' as const };
  const sessions = [at('2026-11-02', '09:00'), at('2026-11-04', '09:00'), at('2026-11-09', '09:00')];
  assert.equal(toggleSession(sessions, at('2026-11-06', '09:00'), 0, [], cap).kind, 'limit');
  assert.equal(toggleSession(sessions, at('2026-11-10', '09:00'), 0, [], cap).kind, 'saved');
});

test('a time that overlaps is reported as an overlap, not as the allowance', () => {
  const cap = { limit: 1, per: 'month' as const };
  const sessions = [at('2026-11-03', '09:00', 60)];
  assert.equal(toggleSession(sessions, at('2026-11-03', '09:30', 30), 0, [], cap).kind, 'overlap');
});

test('sessions of other services never count towards the allowance', () => {
  const cap = { limit: 1, per: 'month' as const };
  const others = [{ ...at('2026-11-04', '14:00'), service: 'Bateria' }];
  assert.equal(toggleSession([], at('2026-11-03', '09:00'), 0, others, cap).kind, 'saved');
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
    duration: 60,
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
  assert.deepEqual(previewSlots({ duration: 60, days: [], times: ['09:00'] }, '2026-10-08', '2026-10-31', today), []);
  assert.deepEqual(previewSlots({ duration: 60, days: all, times: [] }, '2026-10-08', '2026-10-31', today), []);
  const clipped = previewSlots({ duration: 60, days: all, times: ['09:00'] }, '2026-10-10', '2026-10-11', today);
  assert.deepEqual(clipped.map(slot => slot.date), ['2026-10-10', '2026-10-11']);
  assert.equal(clipped[0].remaining, 1);
});

test('preview slots offer every duration of the service', () => {
  const today = new Date(2026, 9, 8);
  const [slot] = previewSlots(
    { duration: 60, extra_durations: [{ duration: 90, price: 55 }], days: ['mon'], times: ['09:00'] },
    '2026-10-12',
    '2026-10-12',
    today
  );
  assert.deepEqual(slot.durations, [60, 90]);
});

test('a chosen session is kept only while its duration is still offered', () => {
  const range = { from: '2026-10-01', to: '2026-10-31' };
  const slots = [{ date: '2026-10-12', time: '09:00', durations: [60] }];
  const sessions = [
    { date: '2026-10-12', time: '09:00', duration: 60 },
    { date: '2026-10-12', time: '09:00', duration: 90 },
  ];
  assert.deepEqual(keepFree(sessions, slots, range), [sessions[0]]);
});

const pattern = (weekdays: string[], time: string, month = '2026-11') => ({ month, weekdays, time });
const guitar = (date: string, time: string, duration = 60) => ({ date, time, duration, service: 'Guitarra' });
const today = new Date(2026, 10, 2);

test('a weekday pattern that lands on a session of another service is a clash, and says which', () => {
  const others = [guitar('2026-11-18', '09:30')];
  assert.deepEqual(monthlyClash(pattern(['wed'], '09:00'), 60, others, 0, today), others[0]);
  assert.equal(monthlyClash(pattern(['mon', 'tue'], '09:00'), 60, others, 0, today), undefined);
  assert.equal(monthlyClash(pattern(['wed'], '10:30'), 60, others, 0, today), undefined);
});

test('the gap between sessions counts for a weekday pattern too', () => {
  const others = [guitar('2026-11-18', '10:00')];
  assert.equal(monthlyClash(pattern(['wed'], '09:00'), 60, others, 0, today), undefined);
  assert.deepEqual(monthlyClash(pattern(['wed'], '09:00'), 60, others, 30, today), others[0]);
});

test('a weekday pattern only looks at the days still to come in the month', () => {
  const others = [guitar('2026-11-02', '09:00')];
  assert.equal(monthlyClash(pattern(['mon'], '09:00'), 60, others, 0, new Date(2026, 10, 3)), undefined);
  assert.deepEqual(monthlyClash(pattern(['mon'], '09:00'), 60, others, 0, today), others[0]);
});

test('a weekday pattern the other service never touches is not a clash', () => {
  assert.equal(monthlyClash(pattern(['wed'], '09:00'), 60, [], 0, today), undefined);
  assert.equal(monthlyClash(pattern([], '09:00'), 60, [guitar('2026-11-18', '09:00')], 0, today), undefined);
  assert.equal(monthlyClash(pattern(['wed'], '09:00', '2026-12'), 60, [guitar('2026-11-18', '09:00')], 0, today), undefined);
});

test('the gap between sessions is read from the question or its rules', () => {
  assert.equal(bufferOf({ buffer_minutes: 15, rules: { buffer_minutes: 30 } }), 15);
  assert.equal(bufferOf({ rules: { buffer_minutes: 30 } }), 30);
  assert.equal(bufferOf({}), 0);
});
