export type AppointmentActionName =
  'approve' | 'decline' | 'cancel' | 'remind' | 'reschedule';

export interface AppointmentActionParams {
  id: number;
  action: AppointmentActionName;
  data?: { message?: string; reason?: string; date?: string; time?: string };
}

export type AppointmentActionError =
  | 'expired'
  | 'already_decided'
  | 'nothing_to_cancel'
  | 'too_soon'
  | 'no_email'
  | 'nothing_to_remind'
  | 'same_time'
  | 'unavailable'
  | 'not_reschedulable'
  | 'invalid_decision';
