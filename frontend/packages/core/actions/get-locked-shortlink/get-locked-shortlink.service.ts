import type { LockedShortlink } from './get-locked-shortlink.types';

// Runs inside an SSR loader: plain fetch, no session store (see
// get-public-page). Returns null when the link does not exist, has no
// password, or no longer works.
export async function getLockedShortlink(
  shortCode: string
): Promise<LockedShortlink | null> {
  const response = await fetch(
    `${import.meta.env.VITE_BASE_URL}/api/public/shortlinks/${encodeURIComponent(shortCode)}`,
    { headers: { Accept: 'application/json' } }
  );

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Failed to load shortlink ${shortCode}: ${response.status}`);
  }

  return response.json();
}
