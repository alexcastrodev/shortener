import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { FormField } from '@internal/core/types/Form';
import {
  blankException,
  blankService,
  initialValues,
  removeCategory,
  splitIntoCategories,
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
    buffer_minutes: 0,
    approval_timeout_minutes: 60,
    approval_on_timeout: 'accept',
    approval_within_minutes: null,
    reminder_minutes: [1440],
    verify_email: false,
    waitlist: false,
    waitlist_confirm_minutes: null,
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
    buffer_minutes: 0,
    approval_within_minutes: null,
    reminder_minutes: [1440],
    verify_email: false,
    waitlist: false,
    waitlist_confirm_minutes: null,
  });
});

test('the break between sessions is loaded, sent, and defaults to none', () => {
  assert.equal(initialValues().buffer_minutes, 0);
  const loaded = initialValues({
    ...field,
    rules: { ...field.rules!, buffer_minutes: 15 },
  });
  assert.equal(loaded.buffer_minutes, 15);
  assert.equal(toBookingInput(loaded, false).rules?.buffer_minutes, 15);
  assert.equal(
    toBookingInput({ ...loaded, buffer_minutes: '' }, false).rules
      ?.buffer_minutes,
    0
  );
});

test('clearing the help text on an existing question sends null so the server clears it', () => {
  const values = initialValues(field);
  values.help = '';
  assert.equal(toBookingInput(values, false).help, null);
});

test('a service without price or capacity sends neither, so it is free and unlimited', () => {
  const values = initialValues();
  const service = blankService('New service');
  service.capacity = '';
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

test('a new service lasts 30 minutes, has 1 place, euros, weekdays and times from 09:00 to 18:00', () => {
  const service = blankService('Session');
  assert.equal(service.duration, 30);
  assert.equal(service.capacity, 1);
  assert.equal(service.price, '');
  assert.equal(service.currency, 'EUR');
  assert.deepEqual(service.days, ['mon', 'tue', 'wed', 'thu', 'fri']);
  assert.equal(service.times[0].value, '09:00');
  assert.equal(service.times.at(-1)?.value, '17:30');
  const values = initialValues();
  values.services = [service];
  const [sent] = toBookingInput(values, true).services!;
  assert.equal(sent.capacity, 1);
  assert.equal('currency' in sent, false);
  assert.equal(sent.times.length, 18);
});

test('a saved service without a currency loads with euros, and a saved code is kept', () => {
  const values = initialValues({
    ...field,
    services: [
      { ...field.services![0], price: null, currency: null },
      { ...field.services![0], id: 'svc00002', currency: 'BRL' },
    ],
  });
  assert.deepEqual(
    values.services.map(service => service.currency),
    ['EUR', 'BRL']
  );
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

test('weekday times load, are sent only for days the service runs, and an empty list closes the day', () => {
  const values = initialValues({
    ...field,
    services: [
      {
        ...field.services![0],
        times_by_day: { mon: ['14:00', '09:00'], wed: [] },
      },
    ],
  });
  assert.deepEqual(
    values.services[0].byDay.mon.map(time => time.value),
    ['14:00', '09:00']
  );
  assert.deepEqual(values.services[0].byDay.wed, []);
  assert.deepEqual(toBookingInput(values, false).services![0].times_by_day, {
    mon: ['09:00', '14:00'],
    wed: [],
  });

  values.services[0].days = ['mon'];
  assert.deepEqual(toBookingInput(values, false).services![0].times_by_day, {
    mon: ['09:00', '14:00'],
  });
});

test('a service without weekday times sends none, so the general times apply', () => {
  const [sent] = toBookingInput(initialValues(field), false).services!;
  assert.equal('times_by_day' in sent, false);
});

test('a package loads, and is sent only while it is on and the service has a price', () => {
  const withBundle: FormField = {
    ...field,
    services: [{ ...field.services![0], bundle: { take: 10, pay: 8 } }],
  };
  const values = initialValues(withBundle);
  assert.equal(values.services[0].bundle, true);
  assert.deepEqual(toBookingInput(values, false).services![0].bundle, {
    take: 10,
    pay: 8,
  });

  values.services[0].price = '';
  assert.equal('bundle' in toBookingInput(values, false).services![0], false);

  values.services[0].price = 25;
  values.services[0].bundle = false;
  assert.equal('bundle' in toBookingInput(values, false).services![0], false);
});

test('a new service starts without a package, with 5 for 4 ready if it is turned on', () => {
  const service = blankService('Class');
  assert.deepEqual(
    [service.bundle, service.bundleTake, service.bundlePay],
    [false, 5, 4]
  );
});

test('a form with one category or none saves no categories and no category ids', () => {
  const values = initialValues(field);
  const input = toBookingInput(values, false);
  assert.deepEqual(input.categories, []);
  assert.equal('category_id' in input.services![0], false);
});

test('separating the services makes two categories and puts every service in the first', () => {
  const values = splitIntoCategories(
    {
      ...initialValues(field),
      services: [blankService('A'), blankService('B')],
    },
    ['Body', 'Face']
  );
  assert.deepEqual(
    values.categories.map(item => item.name),
    ['Body', 'Face']
  );
  assert.ok(values.categories.every(item => /^[A-Za-z0-9]{8}$/.test(item.id)));
  assert.ok(
    values.services.every(item => item.categoryId === values.categories[0].id)
  );
  const input = toBookingInput(values, false);
  assert.equal(input.categories!.length, 2);
  assert.ok(
    input.services!.every(item => item.category_id === values.categories[0].id)
  );
});

test('removing a category moves its services and never deletes one', () => {
  const split = splitIntoCategories(
    {
      ...initialValues(field),
      services: [blankService('A'), blankService('B')],
    },
    ['Body', 'Face']
  );
  const [body, face] = split.categories;
  const moved = removeCategory(
    {
      ...split,
      services: split.services.map((item, i) =>
        i === 1 ? { ...item, categoryId: face.id } : item
      ),
    },
    face.id,
    body.id
  );
  assert.equal(moved.services.length, 2);
  assert.ok(moved.services.every(item => item.categoryId === body.id));
  assert.deepEqual(moved.categories, [body]);
  assert.deepEqual(toBookingInput(moved, false).categories, []);
});

test('removing into a category that does not exist changes nothing', () => {
  const split = splitIntoCategories(initialValues(field), ['Body', 'Face']);
  assert.equal(removeCategory(split, split.categories[1].id, 'nope'), split);
});

test('loads the stored category of each service', () => {
  const values = initialValues({
    ...field,
    categories: [
      { id: 'cat00001', name: 'Body' },
      { id: 'cat00002', name: 'Face' },
    ],
    services: [{ ...field.services![0], category_id: 'cat00002' }],
  });
  assert.equal(values.services[0].categoryId, 'cat00002');
  assert.equal(
    toBookingInput(values, false).services![0].category_id,
    'cat00002'
  );
});

test('the last-minute window is sent only for manual approval with the switch on, and cleared otherwise', () => {
  const base = initialValues(field);
  assert.equal(base.approval_soon_only, false);
  assert.equal(
    toBookingInput(base, false).rules?.approval_within_minutes,
    null
  );
  const on = {
    ...base,
    approval_soon_only: true,
    approval_within_minutes: 1440,
  };
  assert.equal(toBookingInput(on, false).rules?.approval_within_minutes, 1440);
  assert.equal(
    toBookingInput({ ...on, approval: 'auto' }, false).rules
      ?.approval_within_minutes,
    null
  );
  const loaded = initialValues({
    ...field,
    rules: { ...field.rules!, approval_within_minutes: 120 },
  });
  assert.equal(loaded.approval_soon_only, true);
  assert.equal(loaded.approval_within_minutes, 120);
});

test('reminder times are loaded newest first, deduplicated and sent as a list', () => {
  const loaded = initialValues({
    ...field,
    rules: { ...field.rules!, reminder_minutes: [120, 1440] },
  });
  assert.deepEqual(loaded.reminder_minutes, [1440, 120]);
  assert.deepEqual(
    toBookingInput({ ...loaded, reminder_minutes: [120, 120, 60] }, false).rules
      ?.reminder_minutes,
    [120, 60]
  );
  assert.deepEqual(
    toBookingInput({ ...loaded, reminder_minutes: [] }, false).rules
      ?.reminder_minutes,
    []
  );
  assert.deepEqual(initialValues(undefined).reminder_minutes, [1440]);
});

test('email verification is sent only for automatic approval, and loaded back', () => {
  const base = initialValues({
    ...field,
    rules: { ...field.rules!, approval: 'auto', verify_email: true },
  });
  assert.equal(base.verify_email, true);
  assert.equal(toBookingInput(base, false).rules?.verify_email, true);
  assert.equal(
    toBookingInput({ ...base, approval: 'manual' }, false).rules?.verify_email,
    false
  );
  assert.equal(initialValues(undefined).verify_email, false);
});

test('the monthly offer is sent with its informative price only when the service has a price', () => {
  const values = initialValues(field);
  const on = {
    ...values,
    services: [{ ...values.services[0], monthly: true, monthlyPrice: 120 }],
  };
  assert.deepEqual(toBookingInput(on, false).services![0].monthly, {
    price: 120,
  });
  const noPrice = {
    ...values,
    services: [
      { ...values.services[0], monthly: true, monthlyPrice: '' as const },
    ],
  };
  assert.deepEqual(toBookingInput(noPrice, false).services![0].monthly, {});
  assert.equal('monthly' in toBookingInput(values, false).services![0], false);
  const loaded = initialValues({
    ...field,
    services: [{ ...field.services![0], monthly: { price: 80 } }],
  });
  assert.equal(loaded.services[0].monthly, true);
  assert.equal(loaded.services[0].monthlyPrice, 80);
});

test('the waiting list is sent with its confirmation time, or cleared', () => {
  const on = { ...initialValues(field), waitlist: true, waitlist_confirm_minutes: 90 };
  assert.equal(toBookingInput(on, false).rules?.waitlist, true);
  assert.equal(toBookingInput(on, false).rules?.waitlist_confirm_minutes, 90);
  const off = { ...on, waitlist: false };
  assert.equal(toBookingInput(off, false).rules?.waitlist, false);
  assert.equal(toBookingInput(off, false).rules?.waitlist_confirm_minutes, null);
  assert.equal(initialValues(field).waitlist_confirm_minutes, 120);
});

test('a day off that was typed but not added starts blank and is never sent', () => {
  const values = initialValues(undefined);
  assert.equal(values.exceptionDraft.from, '');
  const typed = {
    ...values,
    exceptionDraft: { ...values.exceptionDraft, from: '2026-12-24' },
  };
  assert.deepEqual(toBookingInput(typed, true).exceptions, []);
});
