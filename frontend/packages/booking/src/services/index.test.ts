import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { FormField } from '@internal/core/types/Form';
import { blankService } from '../shared/service.ts';
import { bookingSchema } from '../shared/validation.ts';
import { servicesMode } from './index.ts';

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
  rules: { time_zone: 'Europe/Lisbon', approval: 'auto' },
};

const issues = (values: ReturnType<typeof servicesMode.initialValues>) =>
  bookingSchema(servicesMode.validation, key => key)
    .safeParse(values)
    .error?.issues.map(issue => [issue.path.join('.'), issue.message]) ?? [];

test('a stored question loads with its services and no availability', () => {
  const values = servicesMode.initialValues(field);
  assert.equal(values.services[0].id, 'svc00001');
  assert.equal(values.services[0].price, 25);
  assert.deepEqual(values.availability, { days: [], times: [], byDay: {} });
});

test('a new question has no services yet', () => {
  assert.deepEqual(servicesMode.initialValues().services, []);
});

test('saving keeps service ids, orders days and times, and always sends the schedule', () => {
  const input = servicesMode.toBookingInput(
    servicesMode.initialValues(field),
    false
  );
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
});

test('a service sends its schedule even when it was never marked as having its own', () => {
  const values = servicesMode.initialValues();
  const service = blankService('Session');
  assert.equal(service.ownSchedule, false);
  service.times = [
    { key: 'a', value: '09:00' },
    { key: 'b', value: '09:00' },
  ];
  values.services = [service];
  const [sent] = servicesMode.toBookingInput(values, true).services!;
  assert.deepEqual(sent.days, ['mon', 'tue', 'wed', 'thu', 'fri']);
  assert.deepEqual(sent.times, ['09:00']);
});

test('a new service sends its default weekdays and 18 half-hour times', () => {
  const values = servicesMode.initialValues();
  values.services = [blankService('Session')];
  const [sent] = servicesMode.toBookingInput(values, true).services!;
  assert.equal(sent.capacity, 1);
  assert.equal('currency' in sent, false);
  assert.equal(sent.times?.length, 18);
});

test('a services question round-trips with no mode and no availability', () => {
  const values = servicesMode.initialValues(field);
  for (const creating of [true, false]) {
    const input = servicesMode.toBookingInput(values, creating);
    assert.equal('mode' in input, false);
    assert.equal('availability' in input, false);
    const again = servicesMode.toBookingInput(
      servicesMode.initialValues({ ...field, ...input } as FormField),
      creating
    );
    assert.deepEqual(again, input);
  }
});

test('a form with one category or none saves no categories and no category ids', () => {
  const input = servicesMode.toBookingInput(
    servicesMode.initialValues(field),
    false
  );
  assert.deepEqual(input.categories, []);
  assert.equal('category_id' in input.services![0], false);
});

test('two categories are saved with the category of every service', () => {
  const values = servicesMode.initialValues({
    ...field,
    categories: [
      { id: 'cat00001', name: 'Body' },
      { id: 'cat00002', name: 'Face' },
    ],
    services: [{ ...field.services![0], category_id: 'cat00002' }],
  });
  assert.equal(values.services[0].categoryId, 'cat00002');
  const input = servicesMode.toBookingInput(values, false);
  assert.deepEqual(input.categories, [
    { id: 'cat00001', name: 'Body' },
    { id: 'cat00002', name: 'Face' },
  ]);
  assert.equal(input.services![0].category_id, 'cat00002');
});

test('a service without a stored category falls into the first one', () => {
  const values = servicesMode.initialValues({
    ...field,
    categories: [
      { id: 'cat00001', name: 'Body' },
      { id: 'cat00002', name: 'Face' },
    ],
  });
  assert.equal(values.services[0].categoryId, 'cat00001');
});

test('a new service goes into the first category', () => {
  const values = servicesMode.initialValues({
    ...field,
    categories: [
      { id: 'cat00001', name: 'Body' },
      { id: 'cat00002', name: 'Face' },
    ],
  });
  assert.equal(servicesMode.blankItem(values, 'Massage').categoryId, 'cat00001');
  assert.equal(
    servicesMode.blankItem(servicesMode.initialValues(), 'Massage').categoryId,
    ''
  );
});

test('the group of a service is its category, and only when there are two or more', () => {
  const values = servicesMode.initialValues({
    ...field,
    categories: [
      { id: 'cat00001', name: 'Body' },
      { id: 'cat00002', name: 'Face' },
    ],
    services: [{ ...field.services![0], category_id: 'cat00002' }],
  });
  assert.equal(servicesMode.groupOf(values, values.services[0]), 'Face');
  const single = { ...values, categories: values.categories.slice(0, 1) };
  assert.equal(servicesMode.groupOf(single, single.services[0]), undefined);
});

test('every service has a schedule to show and to complete', () => {
  assert.equal(servicesMode.scheduled(blankService('Session')), true);
  assert.equal(
    servicesMode.scheduled({ ...blankService('Session'), ownSchedule: true }),
    true
  );
});

test('the preview of a services question is the question itself', () => {
  assert.equal(servicesMode.compile(field), field);
});

test('a new booking question has one service with its schedule, and no mode or availability', () => {
  const input = servicesMode.newBooking('Session');
  assert.deepEqual(Object.keys(input), ['services']);
  assert.equal(input.services?.length, 1);
  assert.equal(input.services?.[0].name, 'Session');
  assert.deepEqual(input.services?.[0].days, [
    'mon',
    'tue',
    'wed',
    'thu',
    'fri',
  ]);
});

test('a complete services question has nothing to fix', () => {
  assert.deepEqual(issues(servicesMode.initialValues(field)), []);
});

test('a service needs days and a valid time, whether or not it was marked as having its own schedule', () => {
  const values = servicesMode.initialValues(field);
  values.services[0].days = [];
  values.services[0].times = [{ key: 'a', value: '' }];
  values.services[0].ownSchedule = false;
  assert.deepEqual(issues(values), [
    ['services.0.days', 'error_days'],
    ['services.0.times.0.value', 'error_time'],
  ]);
  values.services[0].times = [];
  assert.deepEqual(issues(values), [
    ['services.0.days', 'error_days'],
    ['services.0.times', 'error_times'],
  ]);
});

test('every category needs a name', () => {
  const values = servicesMode.initialValues({
    ...field,
    categories: [
      { id: 'cat00001', name: 'Body' },
      { id: 'cat00002', name: 'Face' },
    ],
  });
  values.categories[1].name = '  ';
  assert.deepEqual(issues(values), [['categories.1.name', 'category_name_error']]);
});

test('a services question does not need an availability', () => {
  const values = servicesMode.initialValues(field);
  assert.deepEqual(values.availability.days, []);
  assert.deepEqual(issues(values), []);
});
