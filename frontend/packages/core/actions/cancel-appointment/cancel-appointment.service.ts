import { publicApi } from '../api';
import type { GetAppointmentResponse, ManagedAppointment } from '../get-appointment/get-appointment.types';

export async function cancelAppointment(token: string, reason: string): Promise<ManagedAppointment> {
  const response = await publicApi.post<GetAppointmentResponse>(
    `/api/public/appointments/${encodeURIComponent(token)}/cancel`,
    { reason }
  );
  return response.data.appointment;
}
