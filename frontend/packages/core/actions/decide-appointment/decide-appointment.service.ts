import { publicApi } from '../api';
import type { GetAppointmentDecisionResponse } from '../get-appointment-decision/get-appointment-decision.types';

export async function decideAppointment(
  token: string,
  decision: 'approve' | 'decline',
  message: string
): Promise<GetAppointmentDecisionResponse> {
  const response = await publicApi.post<GetAppointmentDecisionResponse>(
    `/api/public/appointment_decisions/${encodeURIComponent(token)}`,
    { decision, message }
  );
  return response.data;
}
