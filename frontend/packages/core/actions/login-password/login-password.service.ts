import type { AxiosResponse } from 'axios';
import { publicApi } from '../api';
import type { LoginPasswordBody } from './login-password.types';
import type { LoginVerifyResponse } from '../login-verify/login-verify.types';

export async function loginWithPassword(
  data: LoginPasswordBody
): Promise<LoginVerifyResponse> {
  const response: AxiosResponse<LoginVerifyResponse> = await publicApi.post(
    '/api/login/password',
    data,
    // Needed for the browser to store the session cookie of a cross-origin response.
    { withCredentials: true }
  );

  return response.data;
}
