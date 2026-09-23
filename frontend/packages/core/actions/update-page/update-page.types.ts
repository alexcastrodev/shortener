import type { Page, PageTheme } from '../../types/Page';

export interface UpdatePageRequestBody {
  slug?: string;
  display_title?: string | null;
  bio?: string | null;
  theme?: PageTheme;
  published?: boolean;
  expires_at?: string | null;
}

export interface UpdatePageParams {
  id: number | string;
  data: UpdatePageRequestBody;
}

export interface UpdatePageResponse {
  page: Page;
}
