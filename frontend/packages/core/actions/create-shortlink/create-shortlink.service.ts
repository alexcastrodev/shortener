import type { AxiosResponse } from 'axios';
import { api } from '../api';
import type {
  CreateShortlinkRequestBody,
  CreateShortlinkResponse,
} from './create-shortlink.types';
import type { Shortlink } from '../../types/Shortlink';

export async function createShortlink(
  data: CreateShortlinkRequestBody
): Promise<Shortlink> {
  const response: AxiosResponse<CreateShortlinkResponse> = await api.post(
    '/api/me/shortlinks',
    data
  );

  return response.data.shortlink;
}
