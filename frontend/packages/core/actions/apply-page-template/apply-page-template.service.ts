import type { AxiosResponse } from 'axios';
import { api } from '../api';
import type { Page } from '../../types/Page';

export interface ApplyPageTemplateParams {
  pageId: number | string;
  template: string;
}

// Replaces the page's links and theme with the template's.
export async function applyPageTemplate({ pageId, template }: ApplyPageTemplateParams): Promise<Page> {
  const response: AxiosResponse<{ page: Page }> = await api.post(
    `/api/me/pages/${pageId}/apply_template`,
    { template }
  );
  return response.data.page;
}
