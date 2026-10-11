import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { BookingRules } from '@internal/core/types/Form';
import { RULE_FIELDS, ruleInput, ruleValues } from './rules.ts';

const stored: BookingRules = {
  time_zone: 'Europe/Lisbon',
  approval: 'manual',
  approval_timeout_minutes: 60,
  approval_on_timeout: 'accept',
  min_notice_minutes: 30,
  window_days: 90,
  max_per_day: 8,
};

test('loads the rules of an existing booking question', () => {
  const values = ruleValues(stored);
  assert.equal(values.approval, 'manual');
  assert.equal(values.approval_timeout_minutes, 60);
  assert.equal(values.max_per_day, 8);
});

test('a new question starts with automatic approval and sensible defaults', () => {
  const values = ruleValues();
  assert.equal(values.approval, 'auto');
  assert.equal(values.window_days, 60);
  assert.equal(values.min_notice_minutes, 0);
});

test('every rule the editor holds is listed, so its errors open the rules section', () => {
  assert.ok(RULE_FIELDS.includes('approval'));
  assert.ok(RULE_FIELDS.includes('waitlist_confirm_minutes'));
  assert.deepEqual(RULE_FIELDS, Object.keys(ruleValues(stored)));
});

test('saving sends the rules', () => {
  assert.deepEqual(ruleInput(ruleValues(stored)), {
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

test('automatic approval sends no deadline', () => {
  assert.deepEqual(ruleInput(ruleValues()), {
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
  assert.equal(ruleValues().buffer_minutes, 0);
  const loaded = ruleValues({ ...stored, buffer_minutes: 15 });
  assert.equal(loaded.buffer_minutes, 15);
  assert.equal(ruleInput(loaded).buffer_minutes, 15);
  assert.equal(ruleInput({ ...loaded, buffer_minutes: '' }).buffer_minutes, 0);
});

test('the last-minute window is sent only for manual approval with the switch on, and cleared otherwise', () => {
  const base = ruleValues(stored);
  assert.equal(base.approval_soon_only, false);
  assert.equal(ruleInput(base).approval_within_minutes, null);
  const on = {
    ...base,
    approval_soon_only: true,
    approval_within_minutes: 1440,
  };
  assert.equal(ruleInput(on).approval_within_minutes, 1440);
  assert.equal(
    ruleInput({ ...on, approval: 'auto' }).approval_within_minutes,
    null
  );
  const loaded = ruleValues({ ...stored, approval_within_minutes: 120 });
  assert.equal(loaded.approval_soon_only, true);
  assert.equal(loaded.approval_within_minutes, 120);
});

test('reminder times are loaded newest first, deduplicated and sent as a list', () => {
  const loaded = ruleValues({ ...stored, reminder_minutes: [120, 1440] });
  assert.deepEqual(loaded.reminder_minutes, [1440, 120]);
  assert.deepEqual(
    ruleInput({ ...loaded, reminder_minutes: [120, 120, 60] }).reminder_minutes,
    [120, 60]
  );
  assert.deepEqual(
    ruleInput({ ...loaded, reminder_minutes: [] }).reminder_minutes,
    []
  );
  assert.deepEqual(ruleValues(undefined).reminder_minutes, [1440]);
});

test('email verification is sent only for automatic approval, and loaded back', () => {
  const base = ruleValues({ ...stored, approval: 'auto', verify_email: true });
  assert.equal(base.verify_email, true);
  assert.equal(ruleInput(base).verify_email, true);
  assert.equal(
    ruleInput({ ...base, approval: 'manual' }).verify_email,
    false
  );
  assert.equal(ruleValues(undefined).verify_email, false);
});

test('the waiting list is sent with its confirmation time, or cleared', () => {
  const on = { ...ruleValues(stored), waitlist: true, waitlist_confirm_minutes: 90 };
  assert.equal(ruleInput(on).waitlist, true);
  assert.equal(ruleInput(on).waitlist_confirm_minutes, 90);
  const off = { ...on, waitlist: false };
  assert.equal(ruleInput(off).waitlist, false);
  assert.equal(ruleInput(off).waitlist_confirm_minutes, null);
  assert.equal(ruleValues(stored).waitlist_confirm_minutes, 120);
});
