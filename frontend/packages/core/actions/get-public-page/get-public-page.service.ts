import type { GetPublicPageResponse } from './get-public-page.types';
import type { PublicPage } from '../../types/Page';

// Runs inside SSR loaders, so it uses plain fetch instead of publicApi: the
// axios instances read the session token from a Zustand store persisted in
// localStorage, which does not exist on the server. Returns null on 404.
export async function getPublicPage(slug: string): Promise<PublicPage | null> {
  const response = await fetch(
    `${import.meta.env.VITE_BASE_URL}/api/public/pages/${encodeURIComponent(slug)}`,
    { headers: { Accept: 'application/json' } }
  );

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Failed to load page ${slug}: ${response.status}`);
  }

  const body: GetPublicPageResponse = await response.json();
  return body.page;
}
