import { publicApi } from '../api';
import type { SignupBody } from './signup.types';

export async function signUp(data: SignupBody): Promise<void> {
  await publicApi.post('/api/signup', data);
}
