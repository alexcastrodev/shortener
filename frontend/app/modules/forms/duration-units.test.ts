import assert from 'node:assert/strict';
import { test } from 'node:test';
import { joinMinutes, splitMinutes, timeoutInRange } from './duration-units.ts';

test('a deadline is shown in the largest unit that divides it evenly', () => {
  assert.deepEqual(splitMinutes(1440), { amount: 1, unit: 'days' });
  assert.deepEqual(splitMinutes(2880), { amount: 2, unit: 'days' });
  assert.deepEqual(splitMinutes(120), { amount: 2, unit: 'hours' });
  assert.deepEqual(splitMinutes(90), { amount: 90, unit: 'minutes' });
  assert.deepEqual(splitMinutes(1500), { amount: 25, unit: 'hours' });
  assert.deepEqual(splitMinutes(5), { amount: 5, unit: 'minutes' });
});

test('an amount and a unit become minutes, and an empty amount stays empty', () => {
  assert.equal(joinMinutes(3, 'days'), 4320);
  assert.equal(joinMinutes(2, 'hours'), 120);
  assert.equal(joinMinutes(45, 'minutes'), 45);
  assert.equal(joinMinutes(1.5, 'hours'), 90);
  assert.equal(joinMinutes('', 'days'), '');
});

test('the deadline must be from 5 minutes to 30 days', () => {
  assert.equal(timeoutInRange(5), true);
  assert.equal(timeoutInRange(43200), true);
  assert.equal(timeoutInRange(4), false);
  assert.equal(timeoutInRange(43201), false);
  assert.equal(timeoutInRange(''), false);
});
