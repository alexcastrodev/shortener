import { AxiosError, type AxiosResponse } from 'axios';
import { api } from '../api';
import type { PageTemplate } from '../../types/Page';

export interface SavePageTemplateParams {
  name: string;
  page_id: number;
}

export async function savePageTemplate(data: SavePageTemplateParams): Promise<PageTemplate> {
  try {
    const response: AxiosResponse<{ page_template: PageTemplate }> = await api.post(
      '/api/me/page_templates',
      data
    );
    return response.data.page_template;
  } catch (error) {
    if (error instanceof AxiosError) throw error.response?.data;
    throw error;
  }
}
