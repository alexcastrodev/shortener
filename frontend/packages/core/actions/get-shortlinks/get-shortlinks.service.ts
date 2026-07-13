import type { AxiosResponse } from 'axios';
import { api } from '../api';
import type { GetShortlinksParams, GetShortlinksResponse } from './get-shortlinks.types';

export async function getShortlinks(
  params?: GetShortlinksParams
): Promise<GetShortlinksResponse> {
  const response: AxiosResponse<GetShortlinksResponse> =
    await api.get('/api/me/shortlinks', { params });

  return response.data;
}
