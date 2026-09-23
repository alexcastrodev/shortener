import { AxiosError, type AxiosResponse } from 'axios';
import { api } from '../api';
import type {
  UpdatePageLinkParams,
  UpdatePageLinkResponse,
} from './update-page-link.types';
import type { PageLink } from '../../types/Page';

export async function updatePageLink({
  pageId,
  id,
  data,
}: UpdatePageLinkParams): Promise<PageLink> {
  try {
    const response: AxiosResponse<UpdatePageLinkResponse> = await api.patch(
      `/api/me/pages/${pageId}/links/${id}`,
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
