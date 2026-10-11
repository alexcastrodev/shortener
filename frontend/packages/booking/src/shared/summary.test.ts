import assert from 'node:assert/strict';
import { test } from 'node:test';
import { blankSchedule, blankService } from './config.ts';
import {
  dayList,
  scheduleSummary,
  serviceProblem,
  serviceSummary,
  type SummaryWords,
} from './summary.ts';

const label = (day: string) => day[0].toUpperCase() + day.slice(1);

const words: SummaryWords = {
  minutes: count => `${count} min`,
  price: (amount, currency) => `${amount} ${currency}`,
  unlimited: 'No limit',
  places: count => `${count} places`,
  also: list => `Also ${list}`,
  monthly: detail => (detail ? `Monthly ${detail}` : 'Monthly'),
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

test('price, no limit, monthly price and own day times all show', () => {
  const service = {
    ...blankService('Yoga'),
    duration: 60 as const,
    price: 12,
    capacity: '' as const,
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
    '60 min · 12 EUR · No limit · Monthly 40 EUR'
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

test('other durations are listed with their prices after the main one', () => {
  const service = {
    ...blankService('Piano'),
    duration: 60 as const,
    price: 40,
    extraDurations: [
      { key: 'a', duration: 90 as const, price: 55 as const },
      { key: 'b', duration: '' as const, price: '' as const },
    ],
  };
  assert.equal(
    serviceSummary(service, words).details,
    '60 min · 40 EUR · Also 90 min 55 EUR · 1 places'
  );
});

test('other durations of a service without a price show only their length', () => {
  const service = {
    ...blankService('Piano'),
    extraDurations: [{ key: 'a', duration: 90 as const, price: '' as const }],
  };
  assert.equal(
    serviceSummary(service, words).details,
    '30 min · Also 90 min · 1 places'
  );
});

test('the monthly offer shows its own duration and price', () => {
  const service = {
    ...blankService('Piano'),
    price: 40,
    monthly: true,
    monthlyPrice: 120,
    monthlyDuration: 45 as const,
  };
  assert.equal(
    serviceSummary(service, words).details,
    '30 min · 40 EUR · 1 places · Monthly 45 min 120 EUR'
  );
});

test('the availability of a teacher reads as its weekdays, its times and the days with own times', () => {
  const availability = {
    ...blankSchedule(60),
    byDay: { wed: [{ key: 'a', value: '15:00' }] },
  };
  assert.equal(
    scheduleSummary(availability, words),
    'Mon–Fri · 9 times · Wed own times'
  );
  assert.equal(serviceProblem({ ...availability, times: [] }), 'times');
});
