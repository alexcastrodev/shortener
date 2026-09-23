import type { TrackPageLinkClickParams } from './track-page-link-click.types';

// keepalive lets the request finish while the browser navigates away to the
// link's destination, so tracking never delays the visitor.
export function trackPageLinkClick({
  slug,
  linkId,
  referer,
}: TrackPageLinkClickParams): void {
  fetch(
    `${import.meta.env.VITE_BASE_URL}/api/public/pages/${encodeURIComponent(slug)}/links/${linkId}/click`,
    {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referer: referer || undefined }),
    }
  ).catch(() => {});
}
