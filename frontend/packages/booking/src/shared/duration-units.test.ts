import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  amountBound,
  joinMinutes,
  splitMinutes,
  timeoutInRange,
} from './duration-units.ts';

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

test('a range can be widened or narrowed per field', () => {
  assert.equal(timeoutInRange(0, 0, 43200), true);
  assert.equal(timeoutInRange(14, 15, 4320), false);
  assert.equal(timeoutInRange(4320, 15, 4320), true);
  assert.equal(timeoutInRange(4321, 15, 4320), false);
});

test('a bound in minutes is shown in the picked unit', () => {
  assert.equal(amountBound(4320, 'days'), 3);
  assert.equal(amountBound(43200, 'hours'), 720);
  assert.equal(amountBound(5, 'hours'), 0.08);
  assert.equal(amountBound(0, 'days'), 0);
});
