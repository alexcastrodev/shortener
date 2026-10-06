import { isAxiosError } from 'axios';
import { publicApi } from '../api';
import type { GetAppointmentDecisionResponse } from './get-appointment-decision.types';

export async function getAppointmentDecision(token: string): Promise<GetAppointmentDecisionResponse | null> {
  try {
    const response = await publicApi.get<GetAppointmentDecisionResponse>(
      `/api/public/appointment_decisions/${encodeURIComponent(token)}`
    );
    return response.data;
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 404) return null;
    throw error;
  }
}
