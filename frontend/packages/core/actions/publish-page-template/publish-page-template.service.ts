import { AxiosError, type AxiosResponse } from 'axios';
import { api } from '../api';
import type { PageTemplate } from '../../types/Page';
import type { PublishPageTemplateParams } from './publish-page-template.types';

export async function publishPageTemplate({
  id,
  ...data
}: PublishPageTemplateParams): Promise<PageTemplate> {
  try {
    const response: AxiosResponse<{ page_template: PageTemplate }> =
      await api.patch(`/api/me/page_templates/${id}`, data);
    return response.data.page_template;
  } catch (error) {
    if (error instanceof AxiosError) throw error.response?.data;
    throw error;
  }
}
