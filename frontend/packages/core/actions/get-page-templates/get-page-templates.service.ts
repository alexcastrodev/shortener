import type { AxiosResponse } from 'axios';
import { api } from '../api';
import type { PageTemplate } from '../../types/Page';

export async function getPageTemplates(): Promise<PageTemplate[]> {
  const response: AxiosResponse<{ page_template: PageTemplate[] }> =
    await api.get('/api/me/page_templates');

  return response.data.page_template;
}
