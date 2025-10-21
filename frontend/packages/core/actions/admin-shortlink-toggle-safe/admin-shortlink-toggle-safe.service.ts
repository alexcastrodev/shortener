import { api } from '../api';
import type { AxiosResponse } from 'axios';
import type { AdminToggleSafeResponse } from './admin-shortlink-toggle-safe.types';

export async function toggleShortlinkSafe(
  id: number | string
): Promise<AdminToggleSafeResponse> {
  try {
    const response: AxiosResponse<AdminToggleSafeResponse> = await api.post(
      `/api/admin/shortlinks/${id}/toggle_safe`
    );

    return response.data;
  } catch (error) {
    throw error;
  }
}
