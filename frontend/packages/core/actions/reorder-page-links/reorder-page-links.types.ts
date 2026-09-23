import type { PageLink } from '../../types/Page';

export interface ReorderPageLinksParams {
  pageId: number | string;
  ids: number[];
}

export interface ReorderPageLinksResponse {
  page_link: PageLink[];
}
