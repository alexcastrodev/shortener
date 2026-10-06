export function publicCoverUrl(
  publicId: string,
  token: string | null | undefined,
  base = import.meta.env.VITE_BASE_URL ?? ''
) {
  return token
    ? `${base}/api/public/forms/${encodeURIComponent(publicId)}/cover/${encodeURIComponent(token)}`
    : null;
}
