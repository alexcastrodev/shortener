// Strict CSP for pages that render user content to anonymous visitors (bio
// pages, password-protected link form). Scripts only run with the
// per-request nonce, so stored content can never execute even if it
// reached the HTML unescaped.
const STRICT_CSP_PATHS = [/^\/u\//, /^\/s\//, /^\/f\//, /^\/oauth\//];
const TURNSTILE_CSP_PATHS = [/^\/f\//];
const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com';

export function needsStrictCsp(pathname: string) {
  return STRICT_CSP_PATHS.some(pattern => pattern.test(pathname));
}

export function strictCsp(nonce: string, pathname = '') {
  const api = new URL(import.meta.env.VITE_BASE_URL).origin;
  const turnstile = TURNSTILE_CSP_PATHS.some(pattern => pattern.test(pathname))
    ? ` ${TURNSTILE_ORIGIN}`
    : '';

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'${turnstile}`,
    // Mantine sets inline style attributes; styles cannot run code.
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    // Avatars are proxied by the API (never loaded from the bucket).
    `img-src 'self' data: blob: ${api}`,
    `connect-src 'self' ${api}${turnstile}`,
    ...(turnstile ? [`frame-src${turnstile}`] : []),
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}
