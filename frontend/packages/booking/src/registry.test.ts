import assert from 'node:assert/strict';
import { test } from 'node:test';
import { individualMode } from './individual/index.ts';
import { modeFor, modes } from './registry.ts';
import { servicesMode } from './services/index.ts';

test('a question without a mode is a services question', () => {
  assert.equal(modeFor(undefined), servicesMode);
  assert.equal(modeFor('services'), servicesMode);
});

test('the teacher mode is found by its stored name', () => {
  assert.equal(modeFor('individual'), individualMode);
});

test('a name nobody knows falls back to services, like the backend leaves such a question alone', () => {
  assert.equal(modeFor('weekly'), servicesMode);
});

test('every mode is registered once under its own name', () => {
  assert.deepEqual(modes.map(mode => mode.name).sort(), [
    'individual',
    'services',
  ]);
  for (const mode of modes) assert.equal(modeFor(mode.name), mode);
});

test('every mode loads and saves a stored question that has nothing but a label', () => {
  const stored = { id: 'f1', type: 'booking' as const, label: 'Lessons' };
  for (const mode of modes) {
    const values = mode.initialValues(stored);
    assert.equal(mode.toBookingInput(values, false).label, 'Lessons');
  }
});
