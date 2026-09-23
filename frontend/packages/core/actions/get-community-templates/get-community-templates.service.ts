import type { AxiosResponse } from 'axios';
import { api } from '../api';
import type {
  CommunityTemplatesSort,
  GetCommunityTemplatesResponse,
} from './get-community-templates.types';

export async function getCommunityTemplates(
  sort: CommunityTemplatesSort,
  page: number
): Promise<GetCommunityTemplatesResponse> {
  const response: AxiosResponse<GetCommunityTemplatesResponse> = await api.get(
    '/api/me/community_templates',
    { params: { sort, page, per_page: 12 } }
  );

  return response.data;
}
