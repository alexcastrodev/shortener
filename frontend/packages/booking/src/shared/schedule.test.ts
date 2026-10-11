import assert from 'node:assert/strict';
import { test } from 'node:test';
import { blankSchedule, fromSchedule, toSchedule } from './schedule.ts';

test('days and times are sent in week and clock order, each time once', () => {
  const schedule = toSchedule({
    days: ['wed', 'mon'],
    times: ['10:00', '09:00', '10:00'],
  });
  assert.deepEqual(fromSchedule(schedule), {
    days: ['mon', 'wed'],
    times: ['09:00', '10:00'],
  });
});

test('weekday times load, are sent only for days that run, and an empty list closes the day', () => {
  const schedule = toSchedule({
    days: ['wed', 'mon'],
    times: ['10:00', '09:00'],
    times_by_day: { mon: ['14:00', '09:00'], wed: [] },
  });
  assert.deepEqual(
    schedule.byDay.mon.map(time => time.value),
    ['14:00', '09:00']
  );
  assert.deepEqual(schedule.byDay.wed, []);
  assert.deepEqual(fromSchedule(schedule).times_by_day, {
    mon: ['09:00', '14:00'],
    wed: [],
  });

  schedule.days = ['mon'];
  assert.deepEqual(fromSchedule(schedule).times_by_day, {
    mon: ['09:00', '14:00'],
  });
});

test('a schedule without weekday times sends none, so the general times apply', () => {
  const schedule = toSchedule({ days: ['mon'], times: ['09:00'] });
  assert.equal('times_by_day' in fromSchedule(schedule), false);
});

test('a missing schedule is empty', () => {
  assert.deepEqual(toSchedule(undefined), { days: [], times: [], byDay: {} });
});

test('a blank schedule runs on weekdays with times from 09:00 to 18:00 one duration apart', () => {
  const schedule = blankSchedule(30);
  assert.deepEqual(schedule.days, ['mon', 'tue', 'wed', 'thu', 'fri']);
  assert.equal(schedule.times[0].value, '09:00');
  assert.equal(schedule.times.at(-1)?.value, '17:30');
  assert.equal(schedule.times.length, 18);
  assert.deepEqual(schedule.byDay, {});
});
