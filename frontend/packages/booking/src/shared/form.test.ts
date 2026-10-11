import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { FormField } from '@internal/core/types/Form';
import { baseInput, baseValues, blankException } from './form.ts';

const field: FormField = {
  id: 'abcd1234',
  type: 'booking',
  label: 'When?',
  rules: { time_zone: 'Europe/Lisbon', approval: 'manual' },
};

test('loads the label and the rules of an existing booking question', () => {
  const values = baseValues(field);
  assert.equal(values.label, 'When?');
  assert.equal(values.approval, 'manual');
  assert.deepEqual(values.exceptions, []);
});

test('saving sends the label and the rules, without the type', () => {
  const input = baseInput(baseValues(field), false);
  assert.equal(input.type, undefined);
  assert.equal(input.label, 'When?');
  assert.equal(input.rules?.approval, 'manual');
});

test('creating sends the type and trims the label', () => {
  const values = baseValues();
  values.label = '  Pick a time ';
  values.help = '';
  const input = baseInput(values, true);
  assert.equal(input.type, 'booking');
  assert.equal(input.label, 'Pick a time');
  assert.equal(input.help, undefined);
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

test('a question stored without a label loads as an empty box', () => {
  const { label: _label, ...unlabelled } = field;
  assert.equal(baseValues(unlabelled).label, '');
});

test('an empty label is sent as null on an existing question so the server clears it', () => {
  const values = baseValues(field);
  values.label = '   ';
  assert.equal(baseInput(values, false).label, null);
});

test('an empty label is left out when the question is created', () => {
  const input = baseInput(baseValues(), true);
  assert.equal(input.label, undefined);
  assert.equal(JSON.stringify(input).includes('"label"'), false);
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
