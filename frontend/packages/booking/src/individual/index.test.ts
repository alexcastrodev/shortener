import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { BookingService, FormField } from '@internal/core/types/Form';
import { blankSchedule } from '../shared/schedule.ts';
import { blankService } from '../shared/service.ts';
import { bookingSchema } from '../shared/validation.ts';
import {
  availabilityRequired,
  blankLesson,
  individualMode,
  setOwnSchedule,
} from './index.ts';

const teacher: FormField = {
  id: 'teach001',
  type: 'booking',
  label: 'Book a lesson',
  mode: 'individual',
  availability: {
    days: ['wed', 'mon'],
    times: ['10:00', '09:00'],
    times_by_day: { wed: ['15:00'] },
  },
  categories: [],
  services: [
    {
      id: 'lesson01',
      name: 'Maths',
      duration: 60,
      price: 30,
      currency: 'EUR',
      capacity: 1,
      extra_durations: [{ duration: 90, price: 40 }],
      monthly: { price: 100 },
    },
    { id: 'lesson02', name: 'Physics', duration: 45 },
  ] as BookingService[],
  rules: { time_zone: 'Europe/Lisbon', approval: 'auto' },
};

const own = {
  id: 'lesson03',
  name: 'Chemistry',
  duration: 90,
  days: ['thu', 'tue'],
  times: ['16:00', '14:00'],
  times_by_day: { thu: ['17:00'] },
} as BookingService;

const issues = (values: ReturnType<typeof individualMode.initialValues>) =>
  bookingSchema(individualMode.validation, key => key)
    .safeParse(values)
    .error?.issues.map(issue => [issue.path.join('.'), issue.message]) ?? [];

test('a teacher question loads its availability and saves lessons without a schedule', () => {
  const values = individualMode.initialValues(teacher);
  assert.deepEqual(values.availability.days, ['wed', 'mon']);
  assert.deepEqual(
    values.availability.byDay.wed.map(time => time.value),
    ['15:00']
  );
  assert.deepEqual(values.services[1].days, []);

  const input = individualMode.toBookingInput(values, false);
  assert.equal('mode' in input, false);
  assert.deepEqual(input.availability, {
    days: ['mon', 'wed'],
    times: ['09:00', '10:00'],
    times_by_day: { wed: ['15:00'] },
  });
  assert.deepEqual(input.categories, []);
  assert.deepEqual(input.services, [
    {
      id: 'lesson01',
      name: 'Maths',
      duration: 60,
      price: 30,
      currency: 'EUR',
      capacity: 1,
      extra_durations: [{ duration: 90, price: 40 }],
      monthly: { price: 100 },
    },
    { id: 'lesson02', name: 'Physics', duration: 45 },
  ]);
  assert.deepEqual(
    individualMode.initialValues({ ...teacher, ...input } as FormField)
      .availability.days,
    ['mon', 'wed']
  );
});

test('creating a teacher question sends the mode, and new lessons get no days, times or category', () => {
  const values = individualMode.initialValues(teacher);
  values.services.push({ ...blankService('Chemistry'), categoryId: 'cat00001' });
  values.categories = [
    { id: 'cat00001', name: 'A' },
    { id: 'cat00002', name: 'B' },
  ];
  const input = individualMode.toBookingInput(values, true);
  assert.equal(input.mode, 'individual');
  assert.equal(input.type, 'booking');
  assert.deepEqual(input.categories, []);
  const added = input.services?.at(-1) ?? {};
  for (const key of ['days', 'times', 'times_by_day', 'category_id']) {
    assert.equal(key in added, false, key);
  }
});

test('a lesson with its own days and times keeps them and the others stay on the availability', () => {
  const values = individualMode.initialValues({
    ...teacher,
    services: [...(teacher.services ?? []), own],
  });
  assert.deepEqual(
    values.services.map(item => item.ownSchedule),
    [false, false, true]
  );

  const input = individualMode.toBookingInput(values, false);
  assert.equal('days' in input.services![0], false);
  assert.deepEqual(input.services![2], {
    id: 'lesson03',
    name: 'Chemistry',
    duration: 90,
    days: ['tue', 'thu'],
    times: ['14:00', '16:00'],
    times_by_day: { thu: ['17:00'] },
  });
  assert.deepEqual(
    individualMode.toBookingInput(
      individualMode.initialValues({ ...teacher, ...input } as FormField),
      false
    ),
    input
  );
});

test('turning the own schedule off sends the lesson without days and times', () => {
  const values = individualMode.initialValues(teacher);
  values.services[0] = {
    ...values.services[0],
    ownSchedule: true,
    ...blankSchedule(90),
  };
  const [first] = individualMode.toBookingInput(values, false).services!;
  assert.deepEqual(first.days, ['mon', 'tue', 'wed', 'thu', 'fri']);
  assert.equal(first.times?.length, 6);

  values.services[0] = { ...values.services[0], ownSchedule: false };
  const [again] = individualMode.toBookingInput(values, false).services!;
  assert.equal('days' in again, false);
  assert.equal('times' in again, false);
});

test('the own schedule switch starts a schedule fitted to the duration and clears it when turned off', () => {
  const lesson = { ...blankLesson('Maths'), duration: 90 as const };
  const on = setOwnSchedule(lesson, true);
  assert.equal(on.ownSchedule, true);
  assert.deepEqual(on.days, ['mon', 'tue', 'wed', 'thu', 'fri']);
  assert.equal(on.times.length, 6);

  const off = setOwnSchedule(on, false);
  assert.equal(off.ownSchedule, false);
  assert.deepEqual([off.days, off.times, off.byDay], [[], [], {}]);

  const unset = setOwnSchedule({ ...lesson, duration: '' }, true);
  assert.equal(unset.times.length, 9);
});

test('a new lesson lasts an hour, has no days or times and uses the teacher availability', () => {
  const lesson = individualMode.blankItem(individualMode.initialValues(), 'Maths');
  assert.equal(lesson.duration, 60);
  assert.deepEqual([lesson.days, lesson.times], [[], []]);
  assert.equal(lesson.ownSchedule, false);
  assert.equal(lesson.categoryId, '');
});

test('a new teacher question has the mode, a weekday availability and one lesson without a schedule', () => {
  const input = individualMode.newBooking('Lesson');
  assert.deepEqual(Object.keys(input).sort(), [
    'availability',
    'mode',
    'services',
  ]);
  assert.equal(input.mode, 'individual');
  assert.deepEqual(input.availability?.days, ['mon', 'tue', 'wed', 'thu', 'fri']);
  assert.equal(input.availability?.times.length, 9);
  assert.equal(input.services?.length, 1);
  assert.equal(input.services?.[0].duration, 60);
  assert.equal('days' in input.services![0], false);
});

test('a lesson shows and completes a schedule only when it has its own, and it belongs to no group', () => {
  const lesson = blankLesson('Maths');
  assert.equal(individualMode.scheduled(lesson), false);
  assert.equal(individualMode.scheduled({ ...lesson, ownSchedule: true }), true);
  assert.equal(
    individualMode.groupOf(individualMode.initialValues(teacher), lesson),
    undefined
  );
});

test('every lesson of a teacher gets the hours of the teacher in the preview', () => {
  const { services } = individualMode.compile(teacher);
  for (const lesson of services ?? []) {
    assert.deepEqual(lesson.days, ['wed', 'mon']);
    assert.deepEqual(lesson.times, ['10:00', '09:00']);
    assert.deepEqual(lesson.times_by_day, { wed: ['15:00'] });
  }
});

test('a lesson with its own days and times keeps them in the preview', () => {
  const { services } = individualMode.compile({
    ...teacher,
    services: [...(teacher.services ?? []), own],
  });
  assert.deepEqual(services?.[0].days, ['wed', 'mon']);
  assert.deepEqual(services?.[2].days, ['thu', 'tue']);
  assert.deepEqual(services?.[2].times, ['16:00', '14:00']);
  assert.deepEqual(services?.[2].times_by_day, { thu: ['17:00'] });
});

test('a teacher without an availability yet previews no hours instead of breaking', () => {
  const { services } = individualMode.compile({
    ...teacher,
    availability: undefined,
  });
  assert.deepEqual(services?.[0].days, []);
  assert.deepEqual(services?.[0].times, []);
});

test('a complete teacher question has nothing to fix', () => {
  assert.deepEqual(issues(individualMode.initialValues(teacher)), []);
});

test('the availability of the teacher needs days and a valid time', () => {
  const values = individualMode.initialValues(teacher);
  values.availability.days = [];
  values.availability.times = [{ key: 'a', value: '25:00' }];
  assert.deepEqual(issues(values), [
    ['availability.times.0.value', 'error_time'],
    ['availability.days', 'error_days'],
  ]);
});

test('an empty availability asks for days and times while a lesson uses it', () => {
  const values = individualMode.initialValues(teacher);
  values.availability = { days: [], times: [], byDay: {} };
  assert.deepEqual(issues(values), [
    ['availability.days', 'error_days'],
    ['availability.times', 'error_times'],
  ]);
});

test('the availability is optional when every lesson has its own days and times', () => {
  const values = individualMode.initialValues({
    ...teacher,
    availability: undefined,
    services: [own, { ...own, id: 'lesson04', name: 'Biology' }],
  });
  assert.deepEqual(
    values.services.map(lesson => lesson.ownSchedule),
    [true, true]
  );
  assert.deepEqual(values.availability.days, []);
  assert.deepEqual(issues(values), []);
});

test('an availability that is there still has to be valid when no lesson needs it', () => {
  const values = individualMode.initialValues({
    ...teacher,
    availability: undefined,
    services: [own],
  });
  values.availability.times = [{ key: 'a', value: '' }];
  assert.deepEqual(issues(values), [['availability.times.0.value', 'error_time']]);
});

test('the availability is needed as soon as one lesson has no schedule of its own, and not before there is a lesson', () => {
  const values = individualMode.initialValues({
    ...teacher,
    availability: undefined,
    services: [own, { id: 'lesson05', name: 'Art', duration: 45 } as BookingService],
  });
  assert.deepEqual(issues(values), [
    ['availability.days', 'error_days'],
    ['availability.times', 'error_times'],
  ]);
  assert.equal(availabilityRequired(values.services), true);
  assert.equal(availabilityRequired(values.services.slice(0, 1)), false);
  assert.equal(availabilityRequired([]), false);
  values.services = [];
  assert.deepEqual(issues(values), []);
});

test('a lesson without its own schedule needs no days or times', () => {
  const values = individualMode.initialValues(teacher);
  assert.deepEqual([values.services[0].days, values.services[0].times], [[], []]);
  assert.deepEqual(issues(values), []);
});

test('a lesson with its own schedule needs days and a valid time', () => {
  const values = individualMode.initialValues({
    ...teacher,
    services: [...(teacher.services ?? []), own],
  });
  values.services[2].days = [];
  values.services[2].times = [{ key: 'a', value: '' }];
  assert.deepEqual(issues(values), [
    ['services.2.days', 'error_days'],
    ['services.2.times.0.value', 'error_time'],
  ]);
});

test('the checks every lesson shares still apply', () => {
  const values = individualMode.initialValues(teacher);
  values.services[0].name = ' ';
  values.services[1].duration = 3;
  assert.deepEqual(issues(values), [
    ['services.0.name', 'error_name'],
    ['services.1.duration', 'error_duration'],
  ]);
});

test('several lessons in one booking needs one currency too, and is fine in the teacher mode otherwise', () => {
  const values = individualMode.initialValues({
    ...teacher,
    rules: { ...teacher.rules!, multiple_services: true },
  });
  assert.deepEqual(issues(values), []);
  values.services[1] = { ...values.services[1], price: 20, currency: 'USD' };
  assert.deepEqual(issues(values), [
    ['services.1.price', 'error_multiple_currency'],
  ]);
});
