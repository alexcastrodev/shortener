import type { AxiosResponse } from 'axios';
import { api } from '../api';
import type {
  AdminGetAuditsParams,
  AdminGetAuditsResponse,
} from './admin-audit.types';

export async function getAdminAudits(
  params?: AdminGetAuditsParams
): Promise<AdminGetAuditsResponse> {
  const response: AxiosResponse<AdminGetAuditsResponse> = await api.get(
    '/api/admin/audits',
    { params }
  );

  return response.data;
}
