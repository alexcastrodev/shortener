import { AxiosError } from 'axios';
import { api } from '../api';
import type { OauthAuthorizationPreview } from '../../types/Oauth';

export async function getOauthAuthorization(
  query: string
): Promise<OauthAuthorizationPreview> {
  try {
    const response = await api.get<OauthAuthorizationPreview>(
      `/api/me/oauth/authorization${query}`
    );
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw { ...error.response?.data, status: error.response?.status };
    }
    throw error;
  }
}
