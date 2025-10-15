import type { AxiosResponse } from 'axios';
import { api } from '../api';
import type { GetManageUsersResponse } from './get-manage-users.types';

export async function getManageUsers(): Promise<GetManageUsersResponse> {
  try {
    const response: AxiosResponse<GetManageUsersResponse> = await api.get(
      '/api/admin/users',
      {
        timeout: 5000,
      }
    );

    return response.data;
  } catch (error) {
    throw error;
  }
}
