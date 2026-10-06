import { publicApi } from '../api';
import type { GetAppointmentResponse, ManagedAppointment } from '../get-appointment/get-appointment.types';

export type CancelTarget = { scope: 'one' | 'remaining'; session: string };

export async function cancelAppointment(
  token: string,
  reason: string,
  target?: CancelTarget
): Promise<ManagedAppointment> {
  const response = await publicApi.post<GetAppointmentResponse>(
    `/api/public/appointments/${encodeURIComponent(token)}/cancel`,
    { reason, ...(target ?? {}) }
  );
  return response.data.appointment;
}
