import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { BookingService } from '@internal/core/types/Form';
import { summarize, summarizeAll } from './booking-summary.ts';

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

test('the total is price times the sessions', () => {
  const today = new Date(2026, 9, 9);
  assert.equal(summarize(service(), days(3), today)?.total, 36);
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
  assert.deepEqual(summary?.sessions[0], {
    date: '2026-11-02',
    time: '16:00',
    duration: 30,
    price: null,
  });
});

test('each session is priced by the duration it was picked with', () => {
  const today = new Date(2026, 9, 9);
  const piano = service({
    duration: 60,
    price: 40,
    extra_durations: [{ duration: 90, price: 55 }],
  });
  const summary = summarize(
    piano,
    {
      service: 's1',
      sessions: [
        { date: '2026-10-13', time: '11:00', duration: 60 },
        { date: '2026-10-15', time: '11:00', duration: 90 },
      ],
    },
    today
  );
  assert.equal(summary?.total, 95);
  assert.deepEqual(
    summary?.sessions.map(session => [session.duration, session.price]),
    [
      [60, 40],
      [90, 55],
    ]
  );
});

test('a session with no duration is priced as the main one', () => {
  const today = new Date(2026, 9, 9);
  const piano = service({
    duration: 60,
    price: 40,
    extra_durations: [{ duration: 90, price: 55 }],
  });
  const summary = summarize(piano, days(2), today);
  assert.equal(summary?.total, 80);
  assert.equal(summary?.sessions[0].duration, 60);
});

test('a monthly booking is made of sessions of the monthly duration', () => {
  const today = new Date(2026, 9, 9);
  const summary = summarize(
    service({ monthly: { price: 120, duration: 45 } }),
    {
      service: 's1',
      sessions: [],
      monthly: { month: '2026-11', weekdays: ['mon'], time: '09:00' },
    },
    today
  );
  assert.equal(summary?.sessions[0].duration, 45);
  assert.equal(summary?.total, 120);
});

const plan = (...picks: [string, string][]) => ({
  service: 's1',
  sessions: [],
  monthly: {
    month: '2026-11',
    sessions: picks.map(([date, time]) => ({ date, time })),
  },
});

test('a plan lists the days it was picked with, each with its own time, for the plan price once', () => {
  const today = new Date(2026, 9, 9);
  const summary = summarize(
    service({ monthly: { price: 120, duration: 45, sessions: 5 } }),
    plan(['2026-11-03', '09:00'], ['2026-11-05', '10:30'], ['2026-11-17', '09:00']),
    today
  );
  assert.equal(summary?.kind, 'monthly');
  assert.equal(summary?.count, 3);
  assert.equal(summary?.total, 120);
  assert.deepEqual(summary?.allowance, { limit: 5, per: 'month' });
  assert.deepEqual(
    summary?.sessions.map(session => [session.date, session.time, session.duration, session.price]),
    [
      ['2026-11-03', '09:00', 45, null],
      ['2026-11-05', '10:30', 45, null],
      ['2026-11-17', '09:00', 45, null],
    ]
  );
});

test('a plan with fewer picks than the allowance costs the same, and a weekly one says so', () => {
  const today = new Date(2026, 9, 9);
  const summary = summarize(
    service({ monthly: { price: 80, sessions: 1, per: 'week' } }),
    plan(['2026-11-03', '09:00']),
    today
  );
  assert.equal(summary?.count, 1);
  assert.equal(summary?.total, 80);
  assert.deepEqual(summary?.allowance, { limit: 1, per: 'week' });
});

test('a weekday pattern and single sessions carry no allowance, and a plan with no pick is no summary', () => {
  const today = new Date(2026, 9, 9);
  const priced = service({ monthly: { price: 200, sessions: 5 } });
  const pattern = summarize(
    priced,
    {
      service: 's1',
      sessions: [],
      monthly: { month: '2026-11', weekdays: ['mon'], time: '09:00' },
    },
    today
  );
  assert.equal(pattern?.allowance, null);
  assert.equal(summarize(priced, days(1), today)?.allowance, null);
  assert.equal(summarize(priced, plan(), today), null);
});

test('a plan next to single sessions of another service adds the plan price once', () => {
  const today = new Date(2026, 9, 9);
  const all = summarizeAll(
    [
      service({ id: 'massage1', name: 'Massagem', monthly: { price: 150, sessions: 4 } }),
      service({ id: 'guitar01', name: 'Guitarra', price: 40 }),
    ],
    {
      items: [
        { ...plan(['2026-11-03', '09:00'], ['2026-11-10', '09:00']), service: 'massage1' },
        { service: 'guitar01', sessions: days(2).sessions },
      ],
    },
    today
  );
  assert.equal(all?.total, 230);
  assert.equal(all?.count, 4);
});

const guitar = () =>
  service({
    id: 'guitar01',
    name: 'Guitarra',
    price: 40,
    monthly: { price: 300 },
  });
const drums = () =>
  service({
    id: 'drums001',
    name: 'Bateria',
    price: 50,
    monthly: { price: 350 },
  });

test('several services add their totals and sessions, in the order of the answer', () => {
  const today = new Date(2026, 9, 9);
  const all = summarizeAll(
    [guitar(), drums()],
    {
      items: [
        {
          service: 'drums001',
          sessions: [],
          monthly: { month: '2026-11', weekdays: ['mon'], time: '10:00' },
        },
        { service: 'guitar01', sessions: days(2).sessions },
      ],
    },
    today
  );
  assert.deepEqual(
    all?.items.map(item => item.service.name),
    ['Bateria', 'Guitarra']
  );
  assert.equal(all?.total, 430);
  assert.equal(all?.currency, 'EUR');
  assert.equal(all?.count, 5 + 2);
});

test('a single legacy answer is one item with the same totals as before', () => {
  const today = new Date(2026, 9, 9);
  const all = summarizeAll(
    [guitar(), drums()],
    { ...days(3), service: 'guitar01' },
    today
  );
  assert.equal(all?.items.length, 1);
  assert.equal(all?.total, 120);
  assert.equal(all?.count, 3);
});

test('services with no price add nothing, and no price at all gives no total', () => {
  const today = new Date(2026, 9, 9);
  const free = service({
    id: 'free0001',
    name: 'Free',
    price: null,
    currency: null,
  });
  const mixed = summarizeAll(
    [guitar(), free],
    {
      items: [
        { service: 'free0001', sessions: days(1).sessions },
        { service: 'guitar01', sessions: days(1).sessions },
      ],
    },
    today
  );
  assert.equal(mixed?.total, 40);
  const none = summarizeAll(
    [free],
    { items: [{ service: 'free0001', sessions: days(1).sessions }] },
    today
  );
  assert.equal(none?.total, null);
  assert.equal(none?.currency, null);
});

test('items that are empty or of an unknown service are left out, and nothing left is no summary', () => {
  const today = new Date(2026, 9, 9);
  const all = summarizeAll(
    [guitar()],
    {
      items: [
        { service: 'guitar01', sessions: [] },
        { service: 'gone0001', sessions: days(1).sessions },
      ],
    },
    today
  );
  assert.equal(all, null);
  assert.equal(summarizeAll([guitar()], undefined, today), null);
});
