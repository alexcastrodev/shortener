export interface LoginRequestRequestBody {
  email: string;
  // Cloudflare Turnstile token (see app/modules/auth/turnstile.tsx).
  turnstile_token?: string;
}
