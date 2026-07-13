import { api } from '../api';
import type { AxiosResponse } from 'axios';
import type { AdminUserToggleActiveResponse } from './admin-user-toggle-active.types';

export async function toggleUserActive(
  id: number | string
): Promise<AdminUserToggleActiveResponse> {
  const response: AxiosResponse<AdminUserToggleActiveResponse> = await api.post(
    `/api/admin/users/${id}/toggle_active`
  );

  return response.data;
}
