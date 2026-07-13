import type { AxiosResponse } from 'axios';
import { api } from '../api';
import type { GetShortlinkDetailsResponse } from './get-shortlink-details.types';
import type { Shortlink } from '../../types/Shortlink';

export async function getShortlinkDetails(
  id: number | string
): Promise<Shortlink> {
  const response: AxiosResponse<GetShortlinkDetailsResponse> = await api.get(
    `/api/me/shortlinks/${id}`
  );

  return response.data.shortlink;
}
