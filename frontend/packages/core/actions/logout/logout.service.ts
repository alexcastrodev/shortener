import { publicApi } from '../api';

// Revokes the session on the server and clears the cookie. Never throws: the
// local session is cleared regardless of the outcome.
export async function logout(): Promise<void> {
  try {
    await publicApi.delete('/api/logout', { withCredentials: true });
  } catch {
    // Offline or already signed out.
  }
}
