import type { PageLink } from '../../types/Page';

export interface UpdatePageLinkRequestBody {
  // Only between 'link' and 'social'; headers stay headers.
  kind?: 'link' | 'social';
  label?: string;
  url?: string;
  icon?: string | null;
  active?: boolean;
}

export interface UpdatePageLinkParams {
  pageId: number | string;
  id: number | string;
  data: UpdatePageLinkRequestBody;
}

export interface UpdatePageLinkResponse {
  page_link: PageLink;
}
