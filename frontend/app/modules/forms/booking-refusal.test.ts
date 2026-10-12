import assert from 'node:assert/strict';
import { test } from 'node:test';
import { takenMessage, type TakenWords } from './booking-refusal.ts';

const words: TakenWords = {
  plain: 'taken',
  service: service => `taken ${service}`,
  serviceAt: (service, date, time) => `taken ${service} ${date} ${time}`,
};
const field = {
  services: [
    { id: 'gtr00001', name: 'Guitarra' },
    { id: 'bat00001', name: 'Bateria' },
  ],
} as Parameters<typeof takenMessage>[1];

test('names the service and the time that were refused', () => {
  assert.equal(
    takenMessage(words, field, { service: 'gtr00001', date: '2026-11-03', time: '09:00' }),
    'taken Guitarra 2026-11-03 09:00'
  );
});

test('names only the service when there is no single time to blame', () => {
  assert.equal(takenMessage(words, field, { service: 'bat00001' }), 'taken Bateria');
  assert.equal(
    takenMessage(words, field, { service: 'bat00001', date: '2026-11-03' }),
    'taken Bateria'
  );
});

test('falls back to the plain message without details or for a service it does not know', () => {
  assert.equal(takenMessage(words, field, undefined), 'taken');
  assert.equal(takenMessage(words, field, {}), 'taken');
  assert.equal(
    takenMessage(words, field, { service: 'zzz00000', date: '2026-11-03', time: '09:00' }),
    'taken'
  );
  assert.equal(takenMessage(words, undefined, { service: 'gtr00001' }), 'taken');
});
