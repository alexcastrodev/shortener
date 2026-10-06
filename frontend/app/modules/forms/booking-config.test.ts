import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { FormField } from '@internal/core/types/Form';
import {
  blankException,
  blankService,
  initialValues,
  toBookingInput,
} from './booking-config.ts';

const field: FormField = {
  id: 'abcd1234',
  type: 'booking',
  label: 'When?',
  services: [
    {
      id: 'svc00001',
      name: 'Haircut',
      duration: 45,
      price: 25,
      currency: 'EUR',
      capacity: 2,
      days: ['wed', 'mon'],
      times: ['10:00', '09:00'],
    },
  ],
  rules: {
    time_zone: 'Europe/Lisbon',
    approval: 'manual',
    approval_timeout_minutes: 60,
    approval_on_timeout: 'accept',
    min_notice_minutes: 30,
    window_days: 90,
    max_per_day: 8,
  },
};

test('loads an existing booking question into form values', () => {
  const values = initialValues(field);
  assert.equal(values.label, 'When?');
  assert.equal(values.services[0].id, 'svc00001');
  assert.equal(values.services[0].price, 25);
  assert.equal(values.approval, 'manual');
  assert.equal(values.approval_timeout_minutes, 60);
  assert.equal(values.max_per_day, 8);
});

test('a new question starts with automatic approval and sensible defaults', () => {
  const values = initialValues();
  assert.deepEqual(values.services, []);
  assert.equal(values.approval, 'auto');
  assert.equal(values.window_days, 60);
  assert.equal(values.min_notice_minutes, 0);
});

test('saving keeps service ids, orders days and times, and sends the rules', () => {
  const input = toBookingInput(initialValues(field), false);
  assert.equal(input.type, undefined);
  assert.deepEqual(input.services, [
    {
      id: 'svc00001',
      name: 'Haircut',
      duration: 45,
      price: 25,
      currency: 'EUR',
      capacity: 2,
      days: ['mon', 'wed'],
      times: ['09:00', '10:00'],
    },
  ]);
  assert.deepEqual(input.rules, {
    approval: 'manual',
    min_notice_minutes: 30,
    window_days: 90,
    approval_timeout_minutes: 60,
    approval_on_timeout: 'accept',
    max_per_day: 8,
  });
});

test('creating sends the type; automatic approval sends no deadline', () => {
  const values = initialValues();
  values.label = '  Pick a time ';
  values.help = '';
  const input = toBookingInput(values, true);
  assert.equal(input.type, 'booking');
  assert.equal(input.label, 'Pick a time');
  assert.equal(input.help, undefined);
  assert.deepEqual(input.rules, {
    approval: 'auto',
    min_notice_minutes: 0,
    window_days: 60,
  });
});

test('clearing the help text on an existing question sends null so the server clears it', () => {
  const values = initialValues(field);
  values.help = '';
  assert.equal(toBookingInput(values, false).help, null);
});

test('a service without price or capacity sends neither, so it is free and unlimited', () => {
  const values = initialValues();
  const service = blankService('New service');
  service.times = [
    { key: 'a', value: '09:00' },
    { key: 'b', value: '09:00' },
  ];
  values.services = [service];
  const [sent] = toBookingInput(values, true).services!;
  assert.equal('price' in sent, false);
  assert.equal('currency' in sent, false);
  assert.equal('capacity' in sent, false);
  assert.equal('id' in sent, false);
  assert.deepEqual(sent.times, ['09:00']);
});

test('a price is sent with an upper-case currency', () => {
  const values = initialValues();
  const service = blankService('Class');
  service.price = 12.5;
  service.currency = ' eur ';
  values.services = [service];
  const [sent] = toBookingInput(values, true).services!;
  assert.equal(sent.price, 12.5);
  assert.equal(sent.currency, 'EUR');
});

test('days off load into the screen and come back without changes', () => {
  const withExceptions: FormField = {
    ...field,
    exceptions: [
      {
        id: 'exc00001',
        from: '2026-12-24',
        to: '2026-12-26',
        kind: 'closed',
        note: 'Christmas',
      },
      {
        id: 'exc00002',
        from: '2026-12-31',
        to: '2026-12-31',
        kind: 'special',
        times: ['14:00', '10:00'],
        service_ids: ['svc00001'],
      },
    ],
  };
  const values = initialValues(withExceptions);
  assert.equal(values.exceptions[1].to, '');
  const sent = toBookingInput(values, false).exceptions;
  assert.deepEqual(sent, [
    {
      id: 'exc00001',
      from: '2026-12-24',
      to: '2026-12-26',
      kind: 'closed',
      note: 'Christmas',
    },
    {
      id: 'exc00002',
      from: '2026-12-31',
      kind: 'special',
      times: ['10:00', '14:00'],
      service_ids: ['svc00001'],
    },
  ]);
});

test('a new exception is closed by default and a closed day sends no times or services', () => {
  const values = initialValues();
  const item = blankException();
  item.from = '2026-11-11';
  values.exceptions = [item];
  assert.deepEqual(toBookingInput(values, true).exceptions, [
    { from: '2026-11-11', kind: 'closed' },
  ]);
});

test('removing every exception sends an empty list so the server clears them', () => {
  const values = initialValues({
    ...field,
    exceptions: [{ id: 'exc00001', from: '2026-12-24', kind: 'closed' }],
  });
  values.exceptions = [];
  assert.deepEqual(toBookingInput(values, false).exceptions, []);
});
