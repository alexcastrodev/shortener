import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { BookingItem } from '@internal/core/types/Form';
import {
  answerFrom,
  answerText,
  dropItem,
  isEmptyItem,
  itemsOf,
  setItem,
} from './booking-answer.ts';

const guitar: BookingItem = {
  service: 'guitar01',
  sessions: [
    { date: '2026-11-03', time: '09:00' },
    { date: '2026-11-04', time: '09:00' },
  ],
};
const drums: BookingItem = {
  service: 'drums001',
  sessions: [],
  monthly: { month: '2026-11', weekdays: ['wed'], time: '10:00' },
};

test('both shapes read as a list of items', () => {
  assert.deepEqual(itemsOf(undefined), []);
  assert.deepEqual(itemsOf(guitar), [guitar]);
  assert.deepEqual(itemsOf({ items: [guitar, drums] }), [guitar, drums]);
});

test('the answer is the legacy shape for one service and the items shape when several are allowed', () => {
  assert.equal(answerFrom([], false), undefined);
  assert.equal(answerFrom([], true), undefined);
  assert.equal(answerFrom([guitar], false), guitar);
  assert.deepEqual(answerFrom([guitar], true), { items: [guitar] });
  assert.deepEqual(answerFrom([guitar, drums], true), {
    items: [guitar, drums],
  });
});

test('setting an item replaces the one of its service and keeps the others in place', () => {
  const changed = { ...guitar, sessions: [guitar.sessions[0]] };
  assert.deepEqual(setItem([guitar, drums], changed), [changed, drums]);
  assert.deepEqual(setItem([guitar], drums), [guitar, drums]);
  assert.deepEqual(dropItem([guitar, drums], 'guitar01'), [drums]);
});

test('an item with no session and no monthly choice is empty', () => {
  assert.equal(isEmptyItem({ service: 'x', sessions: [] }), true);
  assert.equal(isEmptyItem(guitar), false);
  assert.equal(isEmptyItem(drums), false);
});

test('an answer reads as text with the dates and times, by service when there are several', () => {
  const names = new Map([
    ['guitar01', 'Guitarra'],
    ['drums001', 'Bateria'],
  ]);
  assert.equal(answerText(guitar, names), '2026-11-03 09:00, 2026-11-04 09:00');
  assert.equal(
    answerText(
      {
        items: [
          guitar,
          { ...drums, sessions: [{ date: '2026-11-05', time: '10:00' }] },
        ],
      },
      names
    ),
    'Guitarra: 2026-11-03 09:00, 2026-11-04 09:00; Bateria: 2026-11-05 10:00'
  );
  assert.equal(
    answerText({ items: [guitar] }, new Map()),
    'guitar01: 2026-11-03 09:00, 2026-11-04 09:00'
  );
});
