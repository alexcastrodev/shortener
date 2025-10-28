import { AxiosError, type AxiosResponse } from 'axios';
import { api } from '../api';
import type {
  CreatePublicShortlinkRequestBody,
  CreatePublicShortlinkResponse,
} from './create-public-shortlink.types';
import type { Shortlink } from '../../types/Shortlink';

export async function createPublicShortlink(
  data: CreatePublicShortlinkRequestBody
): Promise<Shortlink> {
  try {
    const response: AxiosResponse<CreatePublicShortlinkResponse> =
      await api.post('/api/shortlinks', data);
    return response.data.public_shortlink;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw error.response?.data;
    }
    throw error;
  }
}
