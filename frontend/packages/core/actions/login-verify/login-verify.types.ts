import type { User } from '../../types/User';

export interface LoginVerifyRequestBody {
  email: string;
  code: string;
}

export interface LoginVerifyResponse {
  jwt: string;
  user: User;
}
