import { AxiosError } from 'axios';
import { api } from '../api';
import type { AppointmentActionParams } from './appointment-action.types';

export async function appointmentAction({
  id,
  action,
  data,
}: AppointmentActionParams): Promise<void> {
  try {
    await api.post(`/api/me/appointments/${id}/${action}`, data ?? {});
  } catch (error) {
    if (error instanceof AxiosError) {
      throw error.response?.data;
    }
    throw error;
  }
}
