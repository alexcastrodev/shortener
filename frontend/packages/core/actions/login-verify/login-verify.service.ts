import type { AxiosResponse } from 'axios';
import { publicApi } from '../api';
import type {
  LoginVerifyRequestBody,
  LoginVerifyResponse,
} from './login-verify.types';

export async function loginVerifyRequest(
  data: LoginVerifyRequestBody
): Promise<LoginVerifyResponse> {
  const response: AxiosResponse<LoginVerifyResponse> = await publicApi.post(
    '/api/login_verify',
    data,
    // Needed for the browser to store the Set-Cookie of a cross-origin response.
    { withCredentials: true }
  );

  return response.data;
}
