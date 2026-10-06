export interface LoginRequestRequestBody {
  email: string;
  // Cloudflare Turnstile token (see app/modules/auth/turnstile.tsx).
  turnstile_token?: string;
  // The language the person is reading, so the email comes in it.
  locale?: string;
}
