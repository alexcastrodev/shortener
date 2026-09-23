// Strict CSP for pages that render user content to anonymous visitors (bio
// pages, password-protected link form). Scripts only run with the
// per-request nonce, so stored content can never execute even if it
// reached the HTML unescaped.
const STRICT_CSP_PATHS = [/^\/u\//, /^\/s\//];

export function needsStrictCsp(pathname: string) {
  return STRICT_CSP_PATHS.some(pattern => pattern.test(pathname));
}

export function strictCsp(nonce: string) {
  const api = new URL(import.meta.env.VITE_BASE_URL).origin;

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    // Mantine sets inline style attributes; styles cannot run code.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    // Avatars are proxied by the API (never loaded from the bucket).
    `img-src 'self' data: blob: ${api}`,
    `connect-src 'self' ${api}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}
