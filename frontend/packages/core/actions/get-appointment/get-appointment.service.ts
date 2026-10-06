import { isAxiosError } from 'axios';
import { publicApi } from '../api';
import type { GetAppointmentResponse, ManagedAppointment } from './get-appointment.types';

export async function getAppointment(token: string): Promise<ManagedAppointment | null> {
  try {
    const response = await publicApi.get<GetAppointmentResponse>(
      `/api/public/appointments/${encodeURIComponent(token)}`
    );
    return response.data.appointment;
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) return null;
    throw error;
  }
}
