import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { NoticePreference } from '@internal/core/actions/get-notification-preferences/get-notification-preferences.types';
import { cell, change, eventsOf, shownChannels } from './notice-matrix.ts';

const preferences: NoticePreference[] = [
  {
    kind: 'appointment_created',
    channel: 'in_app',
    supported: true,
    enabled: true,
  },
  {
    kind: 'appointment_created',
    channel: 'email',
    supported: true,
    enabled: false,
  },
  {
    kind: 'appointment_created',
    channel: 'push',
    supported: true,
    enabled: true,
  },
  {
    kind: 'appointment_cancelled',
    channel: 'in_app',
    supported: true,
    enabled: true,
  },
  {
    kind: 'appointment_cancelled',
    channel: 'email',
    supported: false,
    enabled: false,
  },
];

test('events keep the server order, once each', () => {
  assert.deepEqual(eventsOf(preferences), [
    'appointment_created',
    'appointment_cancelled',
  ]);
});

test('a cell is found by event and channel, and a missing one is undefined', () => {
  assert.equal(
    cell(preferences, 'appointment_created', 'email')?.enabled,
    false
  );
  assert.equal(
    cell(preferences, 'appointment_cancelled', 'email')?.supported,
    false
  );
  assert.equal(cell(preferences, 'appointment_nope', 'email'), undefined);
});

test('a change sends one cell', () => {
  assert.deepEqual(change('appointment_created', 'email', true), {
    preferences: [
      { kind: 'appointment_created', channel: 'email', enabled: true },
    ],
  });
});

test('push is a column only when the server can send it', () => {
  assert.deepEqual(shownChannels(false), ['in_app', 'email']);
  assert.deepEqual(shownChannels(true), ['in_app', 'email', 'push']);
});
