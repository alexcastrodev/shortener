import type { AxiosResponse } from 'axios';
import { api } from '../api';
import type { AdminGetShortlinksResponse } from './admin-shortlink.types';

export async function getAdminShortlinks(): Promise<AdminGetShortlinksResponse> {
  try {
    const response: AxiosResponse<AdminGetShortlinksResponse> = await api.get(
      '/api/admin/shortlinks'
    );

    return response.data;
  } catch (error) {
    throw error;
  }
}
