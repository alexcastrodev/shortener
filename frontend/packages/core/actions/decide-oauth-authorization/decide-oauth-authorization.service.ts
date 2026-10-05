import { AxiosError } from 'axios';
import { api } from '../api';

export interface DecideOauthAuthorizationParams {
  params: Record<string, string>;
  decision: 'allow' | 'deny';
  grantedScopes: string[];
}

export async function decideOauthAuthorization({
  params,
  decision,
  grantedScopes,
}: DecideOauthAuthorizationParams): Promise<{ redirect_to: string }> {
  try {
    const response = await api.post<{ redirect_to: string }>(
      '/api/me/oauth/authorization',
      { ...params, decision, granted_scopes: grantedScopes }
    );
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw { ...error.response?.data, status: error.response?.status };
    }
    throw error;
  }
}
