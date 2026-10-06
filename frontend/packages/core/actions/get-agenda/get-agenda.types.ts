export interface AgendaAppointment {
  id: number;
  series?: boolean;
  status: 'pending' | 'unverified' | 'confirmed';
  client_name: string | null;
  client_email: string | null;
  group_key: string;
}

export interface AgendaSession {
  form_id: number;
  form_title: string;
  service_id: string;
  service_name: string | null;
  duration: number | null;
  starts_at: string;
  date: string;
  capacity: number | null;
  booked: number;
  pending: number;
  appointments: AgendaAppointment[];
}

export interface GetAgendaResponse {
  time_zone: string;
  sessions: AgendaSession[];
}
