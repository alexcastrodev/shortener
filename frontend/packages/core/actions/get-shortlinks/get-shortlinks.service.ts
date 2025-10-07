import type { AxiosResponse } from 'axios';
import { api } from '../api';
import type { GetShortlinksResponse } from './get-shortlinks.types';
import type { Shortlink } from '../../types/Shortlink';

export async function getShortlinks(): Promise<Shortlink[]> {
  try {
    const response: AxiosResponse<GetShortlinksResponse> = await api.get('/api/me/shortlinks');

    return response.data.shortlink;
  } catch (error) {
    throw error;
  }
}
