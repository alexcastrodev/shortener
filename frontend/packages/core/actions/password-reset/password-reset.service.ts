import type { AxiosResponse } from 'axios';
import { publicApi } from '../api';
import type { PasswordResetBody } from './password-reset.types';
import type { LoginVerifyResponse } from '../login-verify/login-verify.types';

export async function resetPassword(
  data: PasswordResetBody
): Promise<LoginVerifyResponse> {
  const response: AxiosResponse<LoginVerifyResponse> = await publicApi.post(
    '/api/password/reset',
    data,
    // Needed for the browser to store the session cookie of a cross-origin response.
    { withCredentials: true }
  );

  return response.data;
}
