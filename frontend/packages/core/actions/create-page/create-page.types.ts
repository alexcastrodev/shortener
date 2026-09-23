import type { Page, PageTheme } from '../../types/Page';

export interface CreatePageRequestBody {
  slug: string;
  display_title?: string;
  bio?: string;
  theme?: PageTheme;
}

export interface CreatePageResponse {
  page: Page;
}
