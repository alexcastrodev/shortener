import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultGenerator, toGenerateParams } from './time-generator.ts';

test('the default is a working day with an hourly step and a lunch break', () => {
  assert.deepEqual(toGenerateParams(defaultGenerator, 45), {
    from: '09:00',
    to: '18:00',
    step: 60,
    duration: 45,
    lunch: { from: '12:00', to: '13:00' },
  });
});

test('a custom step is sent as the number typed, and no lunch is sent when it is off', () => {
  const params = toGenerateParams(
    { ...defaultGenerator, step: 'custom', customStep: 25, lunch: false },
    30
  );
  assert.equal(params?.step, 25);
  assert.equal('lunch' in (params ?? {}), false);
});

test('a custom step that was not typed yet sends nothing', () => {
  assert.equal(
    toGenerateParams(
      { ...defaultGenerator, step: 'custom', customStep: '' },
      30
    ),
    null
  );
});
