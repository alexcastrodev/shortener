import type { LoginRequestRequestBody } from './login-request.types';
import { api } from '../api';

export async function loginRequest(
  data: LoginRequestRequestBody
): Promise<void> {
  await api.post('/api/login_request', data);
}
