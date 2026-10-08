import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { FormField } from '@internal/core/types/Form';
import { confirmChoice, confirmEnabled } from './confirm-email.ts';

const email = (id: string): FormField => ({ id, type: 'email', label: id });
const booking = (verify_email?: boolean): FormField => ({
  id: 'bk',
  type: 'booking',
  label: 'When?',
  verify_email,
});

const fields = [booking(false), email('a'), email('b')];

test('only active with a booking, no verification and an email question', () => {
  assert.equal(confirmEnabled(fields), true);
  assert.equal(confirmEnabled([booking(true), email('a')]), false);
  assert.equal(confirmEnabled([booking(), { id: 'n', type: 'short_text', label: 'n' }]), false);
  assert.equal(confirmEnabled([email('a')]), false);
  assert.equal(
    confirmEnabled([{ ...booking(), verify_email: undefined, rules: { verify_email: true } as FormField['rules'] }, email('a')]),
    false
  );
});

test('defaults to the first email question with a value', () => {
  assert.equal(confirmChoice(fields, {}, undefined), null);
  assert.equal(confirmChoice(fields, { b: 'b@x.pt' }, undefined), 'b');
  assert.equal(confirmChoice(fields, { a: ' ', b: 'b@x.pt' }, undefined), 'b');
  assert.equal(confirmChoice(fields, { a: 'a@x.pt', b: 'b@x.pt' }, undefined), 'a');
});

test('ticking another moves the choice, unticking leaves none', () => {
  const answers = { a: 'a@x.pt', b: 'b@x.pt' };
  assert.equal(confirmChoice(fields, answers, 'b'), 'b');
  assert.equal(confirmChoice(fields, answers, null), null);
  assert.equal(confirmChoice(fields, { a: 'a@x.pt' }, null), null);
});

test('a chosen question that lost its value leaves none', () => {
  assert.equal(confirmChoice(fields, { a: 'a@x.pt', b: '' }, 'b'), null);
});

test('inactive form never submits a choice', () => {
  assert.equal(confirmChoice([booking(true), email('a')], { a: 'a@x.pt' }, undefined), null);
});
