import { publicApi } from '../api';
import type { PasswordForgotBody } from './password-forgot.types';

export async function requestPasswordReset(
  data: PasswordForgotBody
): Promise<void> {
  await publicApi.post('/api/password/forgot', data);
}
