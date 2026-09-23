import type { AxiosResponse } from 'axios';
import { api } from '../api';
import type {
  AbuseSignalStatus,
  AdminAbuseSignalsResponse,
} from './admin-abuse-signals.types';

export async function getAdminAbuseSignals(
  status: AbuseSignalStatus
): Promise<AdminAbuseSignalsResponse> {
  const response: AxiosResponse<AdminAbuseSignalsResponse> = await api.get(
    '/api/admin/abuse_signals',
    { params: { status } }
  );

  return response.data;
}
