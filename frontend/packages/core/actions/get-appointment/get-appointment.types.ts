export interface AppointmentSession {
  starts_at: string;
  status: string;
}

export interface ManagedAppointment {
  form_title: string;
  service: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  cancellable: boolean;
  time_zone: string;
  sessions: AppointmentSession[];
}

export interface GetAppointmentResponse {
  appointment: ManagedAppointment;
}
