import { api } from '../api';
import type { AxiosResponse } from 'axios';
import type { AdminToggleActiveResponse } from './admin-shortlink-toggle-active.types';

export async function toggleShortlinkActive(
  id: number | string
): Promise<AdminToggleActiveResponse> {
  const response: AxiosResponse<AdminToggleActiveResponse> = await api.post(
    `/api/admin/shortlinks/${id}/toggle_active`
  );

  return response.data;
}
