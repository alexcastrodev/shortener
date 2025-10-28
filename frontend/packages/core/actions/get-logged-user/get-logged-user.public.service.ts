import type { AxiosResponse } from 'axios';
import { publicApi } from '../api';
import type { GetLoggedUserResponse } from './get-logged-user.types';

export async function getLoggedUserPublic(): Promise<GetLoggedUserResponse> {
  try {
    const response: AxiosResponse<GetLoggedUserResponse> = await publicApi.get(
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
