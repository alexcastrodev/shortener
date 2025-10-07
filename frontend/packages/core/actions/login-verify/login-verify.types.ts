import type { User } from '../../types/User';

export interface LoginVerifyRequestBody {
  email: string;
  code: string;
}

export interface LoginVerifyResponse {
  token: string;
  user: User;
}
