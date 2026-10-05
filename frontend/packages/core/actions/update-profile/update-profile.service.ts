import type { AxiosResponse } from 'axios';
import { api } from '../api';
import type {
  UpdateProfileRequestBody,
  UpdateProfileResponse,
} from './update-profile.types';
import type { User } from '../../types/User';

export async function updateProfile(
  data: UpdateProfileRequestBody
): Promise<User> {
  const response: AxiosResponse<UpdateProfileResponse> = await api.patch(
    '/api/me',
    data
  );

  return response.data.user;
}
