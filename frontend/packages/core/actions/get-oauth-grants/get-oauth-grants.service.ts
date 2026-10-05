import { api } from '../api';
import type { OauthGrant } from '../../types/Oauth';

export async function getOauthGrants(): Promise<OauthGrant[]> {
  const response = await api.get<{ oauth_grant: OauthGrant[] }>('/api/me/oauth_grants');
  return response.data.oauth_grant;
}
