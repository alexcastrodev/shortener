import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { FormField } from '@internal/core/types/Form';
import { baseInput, baseValues, blankException } from './form.ts';

const field: FormField = {
  id: 'abcd1234',
  type: 'booking',
  label: 'When?',
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

test('loads the label and the rules of an existing booking question', () => {
  const values = baseValues(field);
  assert.equal(values.label, 'When?');
  assert.equal(values.approval, 'manual');
  assert.equal(values.approval_timeout_minutes, 60);
  assert.equal(values.max_per_day, 8);
});

test('a new question starts with automatic approval and sensible defaults', () => {
  const values = baseValues();
  assert.equal(values.approval, 'auto');
  assert.equal(values.window_days, 60);
  assert.equal(values.min_notice_minutes, 0);
  assert.deepEqual(values.exceptions, []);
});

test('saving sends the rules', () => {
  const input = baseInput(baseValues(field), false);
  assert.equal(input.type, undefined);
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
  const values = baseValues();
  values.label = '  Pick a time ';
  values.help = '';
  const input = baseInput(values, true);
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
  assert.equal(baseValues().buffer_minutes, 0);
  const loaded = baseValues({
    ...field,
    rules: { ...field.rules!, buffer_minutes: 15 },
  });
  assert.equal(loaded.buffer_minutes, 15);
  assert.equal(baseInput(loaded, false).rules?.buffer_minutes, 15);
  assert.equal(
    baseInput({ ...loaded, buffer_minutes: '' }, false).rules?.buffer_minutes,
    0
  );
});

test('clearing the help text on an existing question sends null so the server clears it', () => {
  const values = baseValues(field);
  values.help = '';
  assert.equal(baseInput(values, false).help, null);
});

test('days off load into the screen and come back without changes', () => {
  const values = baseValues({
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
  });
  assert.equal(values.exceptions[1].to, '');
  assert.deepEqual(baseInput(values, false).exceptions, [
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
  const values = baseValues();
  const item = blankException();
  item.from = '2026-11-11';
  values.exceptions = [item];
  assert.deepEqual(baseInput(values, true).exceptions, [
    { from: '2026-11-11', kind: 'closed' },
  ]);
});

test('removing every exception sends an empty list so the server clears them', () => {
  const values = baseValues({
    ...field,
    exceptions: [{ id: 'exc00001', from: '2026-12-24', kind: 'closed' }],
  });
  values.exceptions = [];
  assert.deepEqual(baseInput(values, false).exceptions, []);
});

test('the last-minute window is sent only for manual approval with the switch on, and cleared otherwise', () => {
  const base = baseValues(field);
  assert.equal(base.approval_soon_only, false);
  assert.equal(baseInput(base, false).rules?.approval_within_minutes, null);
  const on = {
    ...base,
    approval_soon_only: true,
    approval_within_minutes: 1440,
  };
  assert.equal(baseInput(on, false).rules?.approval_within_minutes, 1440);
  assert.equal(
    baseInput({ ...on, approval: 'auto' }, false).rules
      ?.approval_within_minutes,
    null
  );
  const loaded = baseValues({
    ...field,
    rules: { ...field.rules!, approval_within_minutes: 120 },
  });
  assert.equal(loaded.approval_soon_only, true);
  assert.equal(loaded.approval_within_minutes, 120);
});

test('reminder times are loaded newest first, deduplicated and sent as a list', () => {
  const loaded = baseValues({
    ...field,
    rules: { ...field.rules!, reminder_minutes: [120, 1440] },
  });
  assert.deepEqual(loaded.reminder_minutes, [1440, 120]);
  assert.deepEqual(
    baseInput({ ...loaded, reminder_minutes: [120, 120, 60] }, false).rules
      ?.reminder_minutes,
    [120, 60]
  );
  assert.deepEqual(
    baseInput({ ...loaded, reminder_minutes: [] }, false).rules
      ?.reminder_minutes,
    []
  );
  assert.deepEqual(baseValues(undefined).reminder_minutes, [1440]);
});

test('email verification is sent only for automatic approval, and loaded back', () => {
  const base = baseValues({
    ...field,
    rules: { ...field.rules!, approval: 'auto', verify_email: true },
  });
  assert.equal(base.verify_email, true);
  assert.equal(baseInput(base, false).rules?.verify_email, true);
  assert.equal(
    baseInput({ ...base, approval: 'manual' }, false).rules?.verify_email,
    false
  );
  assert.equal(baseValues(undefined).verify_email, false);
});

test('the waiting list is sent with its confirmation time, or cleared', () => {
  const on = { ...baseValues(field), waitlist: true, waitlist_confirm_minutes: 90 };
  assert.equal(baseInput(on, false).rules?.waitlist, true);
  assert.equal(baseInput(on, false).rules?.waitlist_confirm_minutes, 90);
  const off = { ...on, waitlist: false };
  assert.equal(baseInput(off, false).rules?.waitlist, false);
  assert.equal(baseInput(off, false).rules?.waitlist_confirm_minutes, null);
  assert.equal(baseValues(field).waitlist_confirm_minutes, 120);
});

test('a day off that was typed but not added starts blank and is never sent', () => {
  const values = baseValues(undefined);
  assert.equal(values.exceptionDraft.from, '');
  const typed = {
    ...values,
    exceptionDraft: { ...values.exceptionDraft, from: '2026-12-24' },
  };
  assert.deepEqual(baseInput(typed, true).exceptions, []);
});
