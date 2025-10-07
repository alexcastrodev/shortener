import type { AxiosResponse } from 'axios';
import { api } from '../api';
import type { GetShortlinksResponse } from './get-shortlinks.types';

export async function getShortlinks(): Promise<GetShortlinksResponse> {
  try {
    const response: AxiosResponse<GetShortlinksResponse> =
      await api.get('/api/me/shortlinks');

    return response.data;
  } catch (error) {
    throw error;
  }
}
