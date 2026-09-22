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
    data
  );

  return response.data;
}
