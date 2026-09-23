import type { PageLink, PageLinkKind } from '../../types/Page';

export interface CreatePageLinkRequestBody {
  kind?: PageLinkKind;
  label: string;
  // Omitted for section headers.
  url?: string;
  icon?: string;
}

export interface CreatePageLinkParams {
  pageId: number | string;
  data: CreatePageLinkRequestBody;
}

export interface CreatePageLinkResponse {
  page_link: PageLink;
}
