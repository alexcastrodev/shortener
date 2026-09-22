import type { LoginRequestRequestBody } from './login-request.types';
import { publicApi } from '../api';

export async function loginRequest(
  data: LoginRequestRequestBody
): Promise<void> {
  await publicApi.post('/api/login_request', data);
}
