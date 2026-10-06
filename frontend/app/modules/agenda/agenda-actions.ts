import type {
  AgendaAppointment,
  AgendaSession,
} from '@internal/core/actions/get-agenda/get-agenda.types';
import type { AppointmentActionError } from '@internal/core/actions/appointment-action/appointment-action.types';

export function pendingTargets(sessions: AgendaSession[]): AgendaAppointment[] {
  const seen = new Set<string>();
  const targets: AgendaAppointment[] = [];
  for (const session of sessions) {
    for (const appointment of session.appointments) {
      if (appointment.status !== 'pending' || seen.has(appointment.group_key))
        continue;
      seen.add(appointment.group_key);
      targets.push(appointment);
    }
  }
  return targets;
}

export function onlyPending(sessions: AgendaSession[]) {
  return sessions.filter(session => session.pending > 0);
}

const KNOWN: AppointmentActionError[] = [
  'expired',
  'already_decided',
  'nothing_to_cancel',
  'too_soon',
  'no_email',
  'nothing_to_remind',
  'same_time',
  'unavailable',
  'not_reschedulable',
  'invalid_decision',
];

export function actionError(
  error: unknown
): AppointmentActionError | 'unknown' {
  const code = (error as { error?: string } | undefined)?.error;
  return KNOWN.find(known => known === code) ?? 'unknown';
}
