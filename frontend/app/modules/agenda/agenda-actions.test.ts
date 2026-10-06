import assert from 'node:assert/strict';
import { test } from 'node:test';
import type {
  AgendaAppointment,
  AgendaSession,
} from '@internal/core/actions/get-agenda/get-agenda.types';
import { actionError, onlyPending, pendingTargets } from './agenda-actions.ts';

const person = (
  id: number,
  group: string,
  status: AgendaAppointment['status']
): AgendaAppointment => ({
  id,
  status,
  client_name: `Client ${id}`,
  client_email: null,
  group_key: group,
});

const session = (appointments: AgendaAppointment[]): AgendaSession => ({
  form_id: 1,
  form_title: 'Salon',
  service_id: 'svc00001',
  service_name: 'Haircut',
  duration: 60,
  starts_at: '2026-11-03T09:00:00Z',
  date: '2026-11-03',
  capacity: 3,
  booked: appointments.length,
  pending: appointments.filter(item => item.status === 'pending').length,
  appointments,
});

test('approve all targets one appointment per waiting booking, even across sessions', () => {
  const targets = pendingTargets([
    session([person(1, 'a', 'pending'), person(2, 'b', 'confirmed')]),
    session([person(3, 'a', 'pending'), person(4, 'c', 'pending')]),
  ]);
  assert.deepEqual(
    targets.map(item => item.id),
    [1, 4]
  );
});

test('nothing waiting means no targets', () => {
  assert.deepEqual(
    pendingTargets([session([person(1, 'a', 'confirmed')])]),
    []
  );
});

test('the waiting filter keeps only sessions with a pending request', () => {
  const list = [
    session([person(1, 'a', 'confirmed')]),
    session([person(2, 'b', 'pending')]),
  ];
  assert.equal(onlyPending(list).length, 1);
});

test('server error codes are recognised and anything else is unknown', () => {
  assert.equal(actionError({ error: 'expired' }), 'expired');
  assert.equal(actionError({ error: 'too_soon' }), 'too_soon');
  assert.equal(actionError({ error: 'something_else' }), 'unknown');
  assert.equal(actionError(undefined), 'unknown');
});
