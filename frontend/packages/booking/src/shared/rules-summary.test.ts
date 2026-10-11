import assert from 'node:assert/strict';
import { test } from 'node:test';
import { splitMinutes } from './duration-units.ts';
import {
  summarizeExceptions,
  summarizeRules,
  type ExceptionSummaryItem,
  type RulesSummaryValues,
} from './rules-summary.ts';

const exceptionLabels = {
  none: 'No days off',
  closed: 'closed',
  special: (times: string) => `hours ${times}`,
  more: (count: number) => `+${count}`,
  date: (iso: string) => iso.slice(5),
};

const closed = (from: string, to = ''): ExceptionSummaryItem => ({
  kind: 'closed',
  from,
  to,
  times: [],
});

test('a single closed day and a closed period read as one line', () => {
  assert.equal(
    summarizeExceptions(
      [closed('2026-10-20'), closed('2026-12-24', '2026-12-31')],
      exceptionLabels
    ),
    '10-20 closed · 12-24 – 12-31 closed'
  );
});

test('a period ending the same day is a single day', () => {
  assert.equal(
    summarizeExceptions([closed('2026-10-20', '2026-10-20')], exceptionLabels),
    '10-20 closed'
  );
});

test('special hours list their valid times in order', () => {
  const special: ExceptionSummaryItem = {
    kind: 'special',
    from: '2026-11-02',
    to: '',
    times: [{ value: '14:00' }, { value: '' }, { value: '10:00' }, { value: '14:00' }],
  };
  assert.equal(
    summarizeExceptions([special], exceptionLabels),
    '11-02 hours 10:00, 14:00'
  );
});

test('no exceptions, or only unfinished ones, says there are none', () => {
  assert.equal(summarizeExceptions([], exceptionLabels), 'No days off');
  assert.equal(summarizeExceptions([closed('')], exceptionLabels), 'No days off');
});

test('exceptions are sorted by date and the rest collapse into a count', () => {
  const items = [
    closed('2026-12-01'),
    closed('2026-10-01'),
    closed('2026-11-01'),
    closed('2026-09-01'),
  ];
  assert.equal(
    summarizeExceptions(items, exceptionLabels),
    '09-01 closed · 10-01 closed · +2'
  );
  assert.equal(
    summarizeExceptions(items, exceptionLabels, 3),
    '09-01 closed · 10-01 closed · 11-01 closed · +1'
  );
  assert.equal(items[0].from, '2026-12-01');
});

const duration = (minutes: number) => {
  const { amount, unit } = splitMinutes(minutes);
  return `${amount} ${unit}`;
};

const ruleLabels = {
  auto: 'Automatic',
  autoVerify: 'Automatic with email check',
  manual: 'You approve',
  waitlist: 'Waiting list',
  reminders: (minutes: number[]) =>
    `Reminder ${minutes.map(duration).join(', ')} before`,
  window: (days: number) => `Up to ${days} days`,
  notice: (minutes: number) => `${duration(minutes)} notice`,
  buffer: (minutes: number) => `${minutes} min between sessions`,
  maxPerDay: (count: number) => `Max ${count} per day`,
};

const rules: RulesSummaryValues = {
  approval: 'auto',
  verify_email: false,
  waitlist: true,
  reminder_minutes: [1440],
  min_notice_minutes: 120,
  window_days: 60,
  buffer_minutes: 0,
  max_per_day: '',
};

test('the rules summary lists what is switched on, with notice in the largest unit', () => {
  assert.equal(
    summarizeRules(rules, ruleLabels),
    'Automatic · Waiting list · Reminder 1 days before · Up to 60 days · 2 hours notice'
  );
});

test('manual approval, email check, break and daily cap show up when set', () => {
  assert.equal(
    summarizeRules(
      {
        ...rules,
        approval: 'manual',
        waitlist: false,
        reminder_minutes: [],
        min_notice_minutes: 0,
        buffer_minutes: 15,
        max_per_day: 8,
      },
      ruleLabels
    ),
    'You approve · Up to 60 days · 15 min between sessions · Max 8 per day'
  );
  assert.equal(
    summarizeRules(
      { ...rules, verify_email: true, waitlist: false, reminder_minutes: [], min_notice_minutes: '', window_days: '' },
      ruleLabels
    ),
    'Automatic with email check'
  );
});

test('manual approval ignores the email check and reminders are listed largest first', () => {
  const text = summarizeRules(
    {
      ...rules,
      approval: 'manual',
      verify_email: true,
      waitlist: false,
      reminder_minutes: [60, 1440, 60],
    },
    ruleLabels
  );
  assert.ok(text.startsWith('You approve · Reminder 1 days, 1 hours before'));
});
