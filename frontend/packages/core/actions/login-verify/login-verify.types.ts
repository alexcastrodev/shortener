import type { User } from '../../types/User';

export interface LoginVerifyRequestBody {
  email: string;
  code: string;
  // "sign_up" confirms a new account and turns on the password chosen at
  // sign-up; a plain sign-in discards it.
  purpose?: 'sign_in' | 'sign_up';
}

// The session token is set as an httpOnly cookie, never returned in the body.
export interface LoginVerifyResponse {
  user: User;
}
