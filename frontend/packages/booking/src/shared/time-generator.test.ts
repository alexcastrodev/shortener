import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  defaultTimes,
  generatorFor,
  toGenerateParams,
} from './time-generator.ts';

test('the generator starts as a working day stepped by the service duration, without a break', () => {
  assert.deepEqual(toGenerateParams(generatorFor(60), 60), {
    from: '09:00',
    to: '18:00',
    step: 60,
    duration: 60,
  });
});

test('a duration that is not a preset becomes a custom step of the same minutes', () => {
  const values = generatorFor(45);
  assert.equal(values.step, 'custom');
  assert.equal(values.customStep, 45);
  assert.equal(toGenerateParams(values, 45)?.step, 45);
});

test('a break is sent when it is on', () => {
  const params = toGenerateParams({ ...generatorFor(30), lunch: true }, 30);
  assert.deepEqual(params?.lunch, { from: '12:00', to: '13:00' });
});

test('a custom step that was not typed yet sends nothing', () => {
  assert.equal(
    toGenerateParams(
      { ...generatorFor(30), step: 'custom', customStep: '' },
      30
    ),
    null
  );
});

test('default times fill 09:00 to 18:00 one session after another', () => {
  const times = defaultTimes(30);
  assert.equal(times.length, 18);
  assert.equal(times[0], '09:00');
  assert.equal(times.at(-1), '17:30');
  assert.deepEqual(defaultTimes(120), ['09:00', '11:00', '13:00', '15:00']);
  assert.deepEqual(defaultTimes(45).at(-1), '17:15');
});

test('a session that does not fit the day, or no duration, gives no default times', () => {
  assert.deepEqual(defaultTimes(600), []);
  assert.deepEqual(defaultTimes(0), []);
});
