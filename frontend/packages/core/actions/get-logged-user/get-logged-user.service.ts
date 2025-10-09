import type { AxiosResponse } from 'axios';
import { api } from '../api';
import type { GetLoggedUserResponse } from './get-logged-user.types';

export async function getLoggedUser(): Promise<GetLoggedUserResponse> {
  try {
    const response: AxiosResponse<GetLoggedUserResponse> = await api.get(
      '/api/me',
      {
        timeout: 5000,
      }
    );

    return response.data;
  } catch (error) {
    throw error;
  }
}
