import type { ResponseError } from '@internal/core/types/ResponseError';
import i18n from '../../i18n';
import type auth from '../../i18n/en/auth.json';

export type AuthError = ResponseError & {
  response?: { status?: number; data?: { error?: string } };
};

type Key = keyof typeof auth;

const MESSAGES: Record<string, [message: Key, title?: Key]> = {
  captcha_failed: ['err_captcha_failed', 'err_captcha_failed_title'],
  invalid_email: ['err_invalid_email'],
  undeliverable_email: ['err_undeliverable_email', 'err_undeliverable_email_title'],
  new_address_limit: ['err_new_address_limit', 'err_new_address_limit_title'],
  daily_limit: ['err_email_limit', 'err_email_limit_title'],
  monthly_limit: ['err_email_limit', 'err_email_limit_title'],
  google_invalid_token: ['err_google_invalid_token'],
  google_email_not_verified: ['err_google_email_not_verified'],
  invalid_credentials: ['err_invalid_credentials'],
  invalid_code: ['err_invalid_code'],
  invalid_current_password: ['err_invalid_current_password'],
  reauthentication_required: ['err_reauthentication_required', 'err_reauthentication_required_title'],
  password_too_short: ['err_password_too_short', 'err_password_too_short_title'],
  password_too_long: ['err_password_too_long', 'err_password_too_long_title'],
  password_matches_email: ['err_password_matches_email', 'err_choose_another_title'],
  password_breached: ['err_password_breached', 'err_choose_another_title'],
};

export function explainAuthError(
  error: AuthError
): [message: string, title?: string] {
  const t = i18n.getFixedT(null, 'auth');
  if (error?.response?.status === 429) {
    return [t('err_rate_limited'), t('err_rate_limited_title')];
  }
  const code = error?.response?.data?.error;
  const entry = code ? MESSAGES[code] : undefined;
  if (!entry) return [t('err_generic')];
  const [message, title] = entry;
  return [t(message), title ? t(title) : undefined];
}
