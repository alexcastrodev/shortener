import type { PageTemplate } from '../../types/Page';

export type CommunityTemplatesSort = 'popular' | 'new';

export interface GetCommunityTemplatesResponse {
  page_template: PageTemplate[];
  meta: { total: number; page: number; per_page: number };
}
