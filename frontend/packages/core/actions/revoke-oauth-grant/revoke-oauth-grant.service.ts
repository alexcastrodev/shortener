import { api } from '../api';

export async function revokeOauthGrant(id: number): Promise<void> {
  await api.delete(`/api/me/oauth_grants/${id}`);
}
