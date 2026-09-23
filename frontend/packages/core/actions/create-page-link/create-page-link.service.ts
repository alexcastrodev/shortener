import { AxiosError, type AxiosResponse } from 'axios';
import { api } from '../api';
import type {
  CreatePageLinkParams,
  CreatePageLinkResponse,
} from './create-page-link.types';
import type { PageLink } from '../../types/Page';

export async function createPageLink({
  pageId,
  data,
}: CreatePageLinkParams): Promise<PageLink> {
  try {
    const response: AxiosResponse<CreatePageLinkResponse> = await api.post(
      `/api/me/pages/${pageId}/links`,
      data
    );
    return response.data.page_link;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw error.response?.data;
    }
    throw error;
  }
}
