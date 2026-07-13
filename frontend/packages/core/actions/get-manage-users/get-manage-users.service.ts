import type { AxiosResponse } from 'axios';
import { api } from '../api';
import type {
  GetManageUsersParams,
  GetManageUsersResponse,
} from './get-manage-users.types';

export async function getManageUsers(
  params?: GetManageUsersParams
): Promise<GetManageUsersResponse> {
  const response: AxiosResponse<GetManageUsersResponse> = await api.get(
    '/api/admin/users',
    { params, timeout: 5000 }
  );

  return response.data;
}
