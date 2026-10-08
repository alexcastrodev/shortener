import assert from 'node:assert/strict';
import { test } from 'node:test';
import { blankService } from './booking-config.ts';
import {
  dayList,
  serviceProblem,
  serviceSummary,
  type SummaryWords,
} from './service-summary.ts';

const label = (day: string) => day[0].toUpperCase() + day.slice(1);

const words: SummaryWords = {
  minutes: count => `${count} min`,
  price: (amount, currency) => `${amount} ${currency}`,
  unlimited: 'No limit',
  places: count => `${count} places`,
  bundle: (take, pay) => `Take ${take} pay ${pay}`,
  monthly: price => (price ? `Monthly ${price}` : 'Monthly'),
  times: count => `${count} times`,
  ownTimes: days => `${days} own times`,
  day: label,
};

test('three or more days in a row become a range, others are listed in week order', () => {
  assert.equal(dayList(['fri', 'mon', 'tue', 'wed', 'thu'], label), 'Mon–Fri');
  assert.equal(dayList(['sat', 'mon', 'wed'], label), 'Mon, Wed, Sat');
  assert.equal(
    dayList(['mon', 'tue', 'thu', 'fri', 'sat'], label),
    'Mon, Tue, Thu–Sat'
  );
  assert.equal(dayList([], label), '');
});

test('a new service reads as duration, places, weekdays and its times', () => {
  const summary = serviceSummary(blankService('Session'), words);
  assert.equal(summary.details, '30 min · 1 places');
  assert.equal(summary.schedule, 'Mon–Fri · 18 times');
});

test('price, no limit, package, monthly price and own day times all show', () => {
  const service = {
    ...blankService('Yoga'),
    duration: 60 as const,
    price: 12,
    capacity: '' as const,
    bundle: true,
    monthly: true,
    monthlyPrice: 40,
    days: ['mon', 'wed', 'sat'],
    times: [
      { key: 'a', value: '18:00' },
      { key: 'b', value: '18:00' },
      { key: 'c', value: '' },
    ],
    byDay: { sat: [{ key: 'd', value: '10:00' }], sun: [] },
  };
  const summary = serviceSummary(service, words);
  assert.equal(
    summary.details,
    '60 min · 12 EUR · No limit · Take 5 pay 4 · Monthly 40 EUR'
  );
  assert.equal(summary.schedule, 'Mon, Wed, Sat · 1 times · Sat own times');
});

test('the monthly offer shows no price while the service has none', () => {
  const service = { ...blankService('Class'), monthly: true, monthlyPrice: 40 };
  assert.equal(
    serviceSummary(service, words).details,
    '30 min · 1 places · Monthly'
  );
});

test('a service without days or without a valid time is incomplete', () => {
  const service = blankService('Class');
  assert.equal(serviceProblem(service), null);
  assert.equal(serviceProblem({ ...service, days: [] }), 'days');
  assert.equal(serviceProblem({ ...service, times: [] }), 'times');
  assert.equal(
    serviceProblem({ ...service, times: [{ key: 'a', value: '' }] }),
    'times'
  );
});
