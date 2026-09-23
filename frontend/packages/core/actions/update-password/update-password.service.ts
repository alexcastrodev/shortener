import type { AxiosResponse } from 'axios';
import { api } from '../api';
import type { UpdatePasswordBody } from './update-password.types';
import type { LoginVerifyResponse } from '../login-verify/login-verify.types';

export async function updatePassword(
  data: UpdatePasswordBody
): Promise<LoginVerifyResponse> {
  const response: AxiosResponse<LoginVerifyResponse> = await api.put(
    '/api/me/password',
    data,
    // Needed for the browser to store the session cookie of a cross-origin response.
    { withCredentials: true }
  );

  return response.data;
}
