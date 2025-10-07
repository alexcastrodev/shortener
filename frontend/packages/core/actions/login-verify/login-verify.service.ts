import type { AxiosResponse } from 'axios';
import { api } from '../api';
import type {
  LoginVerifyRequestBody,
  LoginVerifyResponse,
} from './login-verify.types';

export async function loginVerifyRequest(
  data: LoginVerifyRequestBody
): Promise<LoginVerifyResponse> {
  try {
    const response: AxiosResponse<LoginVerifyResponse> = await api.post(
      '/api/login_verify',
      data
    );

    return response.data;
  } catch (error) {
    throw error;
  }
}
