import type { User } from '../../types/User';

export interface LoginVerifyRequestBody {
  email: string;
  code: string;
  // "sign_up" with a password confirms the account and sets that password; a
  // plain sign-in ignores it.
  purpose?: 'sign_in' | 'sign_up';
  password?: string;
  locale?: string;
}

// The session token is set as an httpOnly cookie, never returned in the body.
export interface LoginVerifyResponse {
  user: User;
  deletion_cancelled?: boolean;
}
