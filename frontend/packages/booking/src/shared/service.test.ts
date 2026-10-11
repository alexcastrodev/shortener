import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { BookingService } from '@internal/core/types/Form';
import { blankService, serviceInput, serviceValues } from './service.ts';

const haircut: BookingService = {
  id: 'svc00001',
  name: 'Haircut',
  duration: 45,
  price: 25,
  currency: 'EUR',
  capacity: 2,
  days: ['wed', 'mon'],
  times: ['10:00', '09:00'],
};

const piano: BookingService = {
  ...haircut,
  duration: 60,
  price: 40,
  extra_durations: [{ duration: 90, price: 55 }],
  monthly: { price: 120, duration: 45 },
};

test('a new service lasts 30 minutes, has 1 place, euros and no price', () => {
  const service = blankService('Session');
  assert.equal(service.duration, 30);
  assert.equal(service.capacity, 1);
  assert.equal(service.price, '');
  assert.equal(service.currency, 'EUR');
  assert.deepEqual(service.extraDurations, []);
  assert.equal(service.monthlyDuration, '');
  assert.equal(service.monthlySessions, '');
  assert.equal(service.monthlyPer, 'month');
  assert.equal(service.ownSchedule, false);
});

test('a service loads with its id as key, and what it sends keeps the id', () => {
  const service = serviceValues(haircut, '');
  assert.equal(service.key, 'svc00001');
  assert.equal(service.id, 'svc00001');
  assert.equal(serviceInput(service).id, 'svc00001');
  assert.equal('id' in serviceInput(blankService('New')), false);
});

test('a service without price or capacity sends neither, so it is free and unlimited', () => {
  const service = blankService('New service');
  service.capacity = '';
  const sent = serviceInput(service);
  assert.equal('price' in sent, false);
  assert.equal('currency' in sent, false);
  assert.equal('capacity' in sent, false);
});

test('the common part sends neither the schedule nor the category', () => {
  const sent = serviceInput(serviceValues(haircut, 'cat00001'));
  for (const key of ['days', 'times', 'times_by_day', 'category_id']) {
    assert.equal(key in sent, false, key);
  }
});

test('a saved service without a currency loads with euros, and a saved code is kept', () => {
  const values = [
    serviceValues({ ...haircut, price: null, currency: null }, ''),
    serviceValues({ ...haircut, currency: 'BRL' }, ''),
  ];
  assert.deepEqual(
    values.map(service => service.currency),
    ['EUR', 'BRL']
  );
});

test('a price is sent with an upper-case currency', () => {
  const service = blankService('Class');
  service.price = 12.5;
  service.currency = ' eur ';
  const sent = serviceInput(service);
  assert.equal(sent.price, 12.5);
  assert.equal(sent.currency, 'EUR');
  assert.equal(serviceInput(blankService('Class')).capacity, 1);
});

test('a service with days and times loads as having its own schedule', () => {
  assert.equal(serviceValues(haircut, '').ownSchedule, true);
  const lesson = { id: 'lesson01', name: 'Maths', duration: 60 };
  assert.equal(
    serviceValues(lesson as BookingService, '').ownSchedule,
    false
  );
});

test('the monthly offer is sent with its informative price only when the service has a price', () => {
  const on = { ...serviceValues(haircut, ''), monthly: true, monthlyPrice: 120 };
  assert.deepEqual(serviceInput(on).monthly, { price: 120 });
  const noPrice = { ...on, price: '' as const };
  assert.deepEqual(serviceInput(noPrice).monthly, {});
  assert.equal('monthly' in serviceInput(serviceValues(haircut, '')), false);
  const loaded = serviceValues({ ...haircut, monthly: { price: 80 } }, '');
  assert.equal(loaded.monthly, true);
  assert.equal(loaded.monthlyPrice, 80);
});

test('other durations and the monthly duration load and are sent back', () => {
  const values = serviceValues(piano, '');
  assert.deepEqual(
    values.extraDurations.map(({ duration, price }) => ({ duration, price })),
    [{ duration: 90, price: 55 }]
  );
  assert.equal(values.monthlyDuration, 45);

  const sent = serviceInput(values);
  assert.deepEqual(sent.extra_durations, [{ duration: 90, price: 55 }]);
  assert.deepEqual(sent.monthly, { price: 120, duration: 45 });
});

test('a service with no other durations sends none', () => {
  assert.equal('extra_durations' in serviceInput(serviceValues(haircut, '')), false);
});

test('an unfinished other duration is not sent, and without a service price no extra price goes out', () => {
  const values = serviceValues(piano, '');
  values.extraDurations.push({ key: 'x', duration: '', price: '' });
  assert.equal(serviceInput(values).extra_durations!.length, 1);

  values.price = '';
  assert.deepEqual(serviceInput(values).extra_durations, [{ duration: 90 }]);
});

test('an empty monthly duration is left out so the service duration applies', () => {
  const values = serviceValues(piano, '');
  values.monthlyDuration = '';
  assert.deepEqual(serviceInput(values).monthly, { price: 120 });
});

test('the allowance of the monthly offer loads and is sent, with the period only when it is per week', () => {
  const loaded = serviceValues(
    { ...piano, monthly: { price: 120, sessions: 5 } },
    ''
  );
  assert.equal(loaded.monthlySessions, 5);
  assert.equal(loaded.monthlyPer, 'month');
  assert.deepEqual(serviceInput(loaded).monthly, { price: 120, sessions: 5 });

  const weekly = serviceValues(
    { ...piano, monthly: { price: 120, sessions: 1, per: 'week' } },
    ''
  );
  assert.equal(weekly.monthlyPer, 'week');
  assert.deepEqual(serviceInput(weekly).monthly, {
    price: 120,
    sessions: 1,
    per: 'week',
  });
});

test('clearing the number removes the allowance, whatever the period was', () => {
  const values = serviceValues(
    { ...piano, monthly: { price: 120, sessions: 1, per: 'week' } },
    ''
  );
  values.monthlySessions = '';
  assert.deepEqual(serviceInput(values).monthly, { price: 120 });

  const none = serviceValues({ ...piano, monthly: { price: 120 } }, '');
  assert.equal(none.monthlySessions, '');
  assert.deepEqual(serviceInput(none).monthly, { price: 120 });
});

test('a monthly offer switched off sends no allowance', () => {
  const values = serviceValues(
    { ...piano, monthly: { price: 120, sessions: 5 } },
    ''
  );
  values.monthly = false;
  assert.equal('monthly' in serviceInput(values), false);
});
