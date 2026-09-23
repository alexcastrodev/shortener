import type { AxiosResponse } from 'axios';
import { api } from '../api';
import type {
  ReorderPageLinksParams,
  ReorderPageLinksResponse,
} from './reorder-page-links.types';
import type { PageLink } from '../../types/Page';

export async function reorderPageLinks({
  pageId,
  ids,
}: ReorderPageLinksParams): Promise<PageLink[]> {
  const response: AxiosResponse<ReorderPageLinksResponse> = await api.patch(
    `/api/me/pages/${pageId}/links/reorder`,
    { ids }
  );

  return response.data.page_link;
}
