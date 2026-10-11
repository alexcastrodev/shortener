import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { BookingService, FormField } from '@internal/core/types/Form';
import { applyBookingDraft } from './booking-draft.ts';
import { previewSlots } from './booking-calendar.ts';

const teacher: FormField = {
  id: 'teach001',
  type: 'booking',
  label: 'Lessons',
  mode: 'individual',
  availability: { days: ['mon'], times: ['09:00', '10:00'] },
  services: [
    { id: 'lesson01', name: 'Maths', duration: 60 },
    { id: 'lesson02', name: 'Physics', duration: 60 },
  ] as BookingService[],
};

const salon: FormField = {
  id: 'salon001',
  type: 'booking',
  label: 'Cuts',
  services: [
    {
      id: 'svc00001',
      name: 'Cut',
      duration: 30,
      days: ['tue'],
      times: ['11:00'],
    },
  ],
};

test('without a draft every lesson of a teacher gets the hours of the teacher', () => {
  const { fields } = applyBookingDraft([teacher, salon], null);
  for (const lesson of fields[0].services ?? []) {
    assert.deepEqual(lesson.days, ['mon']);
    assert.deepEqual(lesson.times, ['09:00', '10:00']);
  }
  assert.equal(fields[1], salon);
});

test('the draft availability reaches every lesson and the preview offers its hours', () => {
  const { fields, serviceId } = applyBookingDraft([teacher], {
    fieldId: 'teach001',
    openIndex: 1,
    input: {
      label: 'Lessons',
      availability: {
        days: ['tue'],
        times: ['14:00'],
        times_by_day: { tue: ['15:00'] },
      },
      services: [
        { id: 'lesson01', name: 'Maths', duration: 60 },
        { name: 'Chemistry', duration: 45 },
      ],
    },
  });
  assert.equal(serviceId, 'draft-1');
  const lessons = fields[0].services ?? [];
  assert.deepEqual(
    lessons.map(item => [item.id, item.days, item.times, item.times_by_day]),
    [
      ['lesson01', ['tue'], ['14:00'], { tue: ['15:00'] }],
      ['draft-1', ['tue'], ['14:00'], { tue: ['15:00'] }],
    ]
  );
  const slots = previewSlots(
    lessons[1],
    '2030-01-01',
    '2030-01-08',
    new Date(2029, 11, 1)
  );
  assert.deepEqual(
    slots.map(slot => slot.starts_at),
    ['2030-01-01T15:00:00', '2030-01-08T15:00:00']
  );
});

test('a teacher without an availability yet previews no hours instead of breaking', () => {
  const { fields } = applyBookingDraft(
    [{ ...teacher, availability: undefined }],
    null
  );
  assert.deepEqual(fields[0].services?.[0].days, []);
  assert.deepEqual(fields[0].services?.[0].times, []);
});

test('a lesson that carries its own days and times keeps them in the preview', () => {
  const { fields } = applyBookingDraft([teacher], {
    fieldId: 'teach001',
    openIndex: 0,
    input: {
      label: 'Lessons',
      availability: { days: ['mon'], times: ['09:00'] },
      services: [
        { id: 'lesson01', name: 'Maths', duration: 60 },
        {
          id: 'lesson02',
          name: 'Physics',
          duration: 90,
          days: ['thu'],
          times: ['14:00'],
        },
      ],
    },
  });
  assert.deepEqual(
    fields[0].services?.map(item => [item.days, item.times]),
    [
      [['mon'], ['09:00']],
      [['thu'], ['14:00']],
    ]
  );
});

test('without a draft a stored lesson with its own hours keeps them', () => {
  const own = {
    id: 'lesson03',
    name: 'Chemistry',
    duration: 90,
    days: ['fri'],
    times: ['15:00'],
  } as BookingService;
  const { fields } = applyBookingDraft(
    [{ ...teacher, services: [...(teacher.services ?? []), own] }],
    null
  );
  assert.deepEqual(fields[0].services?.[0].days, ['mon']);
  assert.deepEqual(fields[0].services?.[2].days, ['fri']);
  assert.deepEqual(fields[0].services?.[2].times, ['15:00']);
});

test('the preview of a lesson lists each duration of a time once even when the draft repeats one', () => {
  const { fields } = applyBookingDraft([teacher], {
    fieldId: 'teach001',
    openIndex: 0,
    input: {
      label: 'Lessons',
      availability: { days: ['mon'], times: ['09:00', '10:00'] },
      services: [
        {
          id: 'lesson01',
          name: 'Maths',
          duration: 60,
          price: 60,
          extra_durations: [
            { duration: 30, price: 20 },
            { duration: 60, price: 60 },
          ],
        },
      ],
    },
  });
  const slots = previewSlots(
    fields[0].services![0],
    '2030-01-01',
    '2030-01-08',
    new Date(2029, 11, 1)
  );
  assert.deepEqual(
    slots.map(slot => [slot.time, slot.durations]),
    [
      ['09:00', [60, 30]],
      ['10:00', [60, 30]],
    ]
  );
});
