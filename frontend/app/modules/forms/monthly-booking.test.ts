import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  monthOptions,
  monthlyComplete,
  monthlyDates,
  toggleWeekday,
} from './monthly-booking.ts';

test('this month and the next are offered, across a year end', () => {
  assert.deepEqual(
    monthOptions(new Date(2026, 10, 15)).map(item => item.value),
    ['2026-11', '2026-12']
  );
  assert.deepEqual(
    monthOptions(new Date(2026, 11, 31)).map(item => item.value),
    ['2026-12', '2027-01']
  );
});

test('the dates are the chosen weekdays of the month, from today on', () => {
  const today = new Date(2026, 10, 2);
  assert.deepEqual(monthlyDates('2026-11', ['mon', 'wed'], today), [
    '2026-11-02',
    '2026-11-04',
    '2026-11-09',
    '2026-11-11',
    '2026-11-16',
    '2026-11-18',
    '2026-11-23',
    '2026-11-25',
    '2026-11-30',
  ]);
  assert.deepEqual(monthlyDates('2026-11', ['mon'], new Date(2026, 10, 10)), [
    '2026-11-16',
    '2026-11-23',
    '2026-11-30',
  ]);
  assert.deepEqual(monthlyDates('2026-12', ['tue'], today), [
    '2026-12-01',
    '2026-12-08',
    '2026-12-15',
    '2026-12-22',
    '2026-12-29',
  ]);
  assert.deepEqual(monthlyDates('2026-11', [], today), []);
});

test('toggling a weekday keeps the week order', () => {
  assert.deepEqual(toggleWeekday(['wed'], 'mon'), ['mon', 'wed']);
  assert.deepEqual(toggleWeekday(['mon', 'wed'], 'mon'), ['wed']);
  assert.deepEqual(toggleWeekday([], 'sun'), ['sun']);
});

test('a choice is complete with a month, a weekday and a time', () => {
  assert.equal(
    monthlyComplete({ month: '2026-11', weekdays: ['mon'], time: '09:00' }),
    true
  );
  assert.equal(
    monthlyComplete({ month: '2026-11', weekdays: [], time: '09:00' }),
    false
  );
  assert.equal(
    monthlyComplete({ month: '', weekdays: ['mon'], time: '09:00' }),
    false
  );
  assert.equal(
    monthlyComplete({ month: '2026-11', weekdays: ['mon'], time: '' }),
    false
  );
});
