import { AxiosError } from 'axios';
import { api } from '../api';
import type {
  GenerateAppointmentTimesParams,
  GenerateAppointmentTimesResponse,
} from './generate-appointment-times.types';

export async function generateAppointmentTimes(
  params: GenerateAppointmentTimesParams
): Promise<GenerateAppointmentTimesResponse> {
  try {
    const response = await api.post<GenerateAppointmentTimesResponse>(
      '/api/me/appointments/generate_times',
      params
    );
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      if (
        error.response?.status === 422 &&
        Array.isArray(error.response.data?.errors)
      ) {
        return error.response.data;
      }
      throw error.response?.data;
    }
    throw error;
  }
}
