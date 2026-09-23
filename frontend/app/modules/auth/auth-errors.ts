import type { ResponseError } from '@internal/core/types/ResponseError';

export type AuthError = ResponseError & {
  response?: { status?: number; data?: { error?: string } };
};

const MESSAGES: Record<string, [message: string, title?: string]> = {
  captcha_failed: [
    'We could not confirm you are human. Please try again.',
    'Check failed',
  ],
  invalid_email: ['That does not look like a valid email address.'],
  undeliverable_email: [
    'We cannot send email to that address. Temporary and disposable addresses are not accepted.',
    'Use another email',
  ],
  new_address_limit: [
    'New sign-ups are paused for today. If you already have an account, you can still sign in.',
    'Try again tomorrow',
  ],
  daily_limit: [
    'Kurz has sent all the emails it can for now. Please try again later.',
    'Email limit reached',
  ],
  monthly_limit: [
    'Kurz has sent all the emails it can for now. Please try again later.',
    'Email limit reached',
  ],
  google_invalid_token: [
    'Google sign-in did not go through. Please try again.',
  ],
  google_email_not_verified: [
    'Your Google account email is not verified yet, so it cannot be used to sign in.',
  ],
  invalid_credentials: [
    'Wrong email or password. Too many attempts pause password sign-in for a while.',
  ],
  invalid_code: ['That code is wrong or expired. Request a new one if needed.'],
  invalid_current_password: ['Your current password is not right.'],
  reauthentication_required: [
    'For your security, sign in again with an email code, then set your password.',
    'Sign in again',
  ],
  password_too_short: ['Use at least 8 characters.', 'Password too short'],
  password_too_long: ['Use at most 128 characters.', 'Password too long'],
  password_matches_email: [
    'Your password should not be based on your email address.',
    'Choose another password',
  ],
  password_breached: [
    'This password appeared in a data breach, so attackers try it first. Please choose another.',
    'Choose another password',
  ],
};

// What an auth endpoint's error means for the person signing in.
export function explainAuthError(
  error: AuthError
): [message: string, title?: string] {
  if (error?.response?.status === 429) {
    return [
      'Too many attempts. Please wait a few minutes and try again.',
      'Slow down',
    ];
  }
  const code = error?.response?.data?.error;
  return (
    (code && MESSAGES[code]) || [
      'Something went wrong, please try again later.',
    ]
  );
}
