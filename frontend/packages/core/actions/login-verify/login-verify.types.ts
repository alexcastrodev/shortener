import type { User } from '../../types/User';

export interface LoginVerifyRequestBody {
  email: string;
  code: string;
}

// The session token is set as an httpOnly cookie, never returned in the body.
export interface LoginVerifyResponse {
  user: User;
}
