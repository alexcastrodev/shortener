export interface DecisionAppointment {
  form_title: string;
  service: string;
  client_name: string | null;
  client_email: string | null;
  status: string;
  expires_at: string | null;
  time_zone: string;
  sessions: { starts_at: string }[];
}

export interface GetAppointmentDecisionResponse {
  appointment: DecisionAppointment;
  result?: 'approve' | 'decline' | 'already_decided' | 'expired';
}
