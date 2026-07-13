import type { AxiosResponse } from 'axios';
import { api } from '../api';
import type {
  AdminGetShortlinksParams,
  AdminGetShortlinksResponse,
} from './admin-shortlink.types';

export async function getAdminShortlinks(
  params?: AdminGetShortlinksParams
): Promise<AdminGetShortlinksResponse> {
  const response: AxiosResponse<AdminGetShortlinksResponse> = await api.get(
    '/api/admin/shortlinks',
    { params }
  );

  return response.data;
}
