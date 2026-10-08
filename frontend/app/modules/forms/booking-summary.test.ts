import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { BookingService } from '@internal/core/types/Form';
import { paidSessions, summarize } from './booking-summary.ts';

const service = (extra: Partial<BookingService> = {}): BookingService => ({
  id: 's1',
  name: 'Sessão',
  duration: 30,
  days: ['mon'],
  times: ['09:00'],
  price: 12,
  currency: 'EUR',
  ...extra,
});

const days = (count: number) => ({
  service: 's1',
  sessions: Array.from({ length: count }, (_, index) => ({
    date: `2026-10-${String(12 + index).padStart(2, '0')}`,
    time: '09:00',
  })),
});

test('without a bundle every session is paid', () => {
  assert.equal(paidSessions(null, 3), 3);
  assert.equal(paidSessions(undefined, 0), 0);
});

test('a take 5 pay 4 bundle matches the server rule', () => {
  const bundle = { take: 5, pay: 4 };
  assert.equal(paidSessions(bundle, 3), 3);
  assert.equal(paidSessions(bundle, 5), 4);
  assert.equal(paidSessions(bundle, 7), 6);
  assert.equal(paidSessions(bundle, 10), 8);
});

test('the total is price times the paid sessions', () => {
  const today = new Date(2026, 9, 9);
  assert.equal(summarize(service(), days(3), today)?.total, 36);
  assert.equal(
    summarize(service({ bundle: { take: 5, pay: 4 } }), days(5), today)?.total,
    48
  );
  assert.equal(summarize(service({ price: 12.5 }), days(3), today)?.total, 37.5);
});

test('without a price or a currency there is no total', () => {
  const today = new Date(2026, 9, 9);
  assert.equal(summarize(service({ price: null }), days(2), today)?.total, null);
  assert.equal(summarize(service({ currency: null }), days(2), today)?.total, null);
});

test('nothing chosen gives no summary', () => {
  const today = new Date(2026, 9, 9);
  assert.equal(summarize(service(), undefined, today), null);
  assert.equal(summarize(undefined, days(1), today), null);
  assert.equal(summarize(service(), days(0), today), null);
});

test('a monthly booking counts the dates of the month and charges the monthly price', () => {
  const today = new Date(2026, 9, 9);
  const summary = summarize(
    service({ monthly: { price: 200 } }),
    {
      service: 's1',
      sessions: [],
      monthly: { month: '2026-11', weekdays: ['mon', 'wed'], time: '16:00' },
    },
    today
  );
  assert.equal(summary?.kind, 'monthly');
  assert.equal(summary?.count, 9);
  assert.equal(summary?.total, 200);
  assert.deepEqual(summary?.sessions[0], { date: '2026-11-02', time: '16:00' });
});
