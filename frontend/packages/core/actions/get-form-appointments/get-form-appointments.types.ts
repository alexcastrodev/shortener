export type AppointmentStatus =
  | 'pending'
  | 'unverified'
  | 'confirmed'
  | 'cancelled'
  | 'declined'
  | 'expired'
  | 'rescheduled';

export interface FormAppointment {
  id: number;
  status: AppointmentStatus;
  starts_at: string;
  service_name: string | null;
  client_name: string | null;
  client_email: string | null;
  group_key: string;
  cancel_reason: string | null;
  created_at: string;
}

export interface GetFormAppointmentsResponse {
  appointments: FormAppointment[];
  next_before: number | null;
}

export interface FormAppointmentFilters {
  status?: AppointmentStatus;
  q?: string;
  from?: string;
  to?: string;
}
