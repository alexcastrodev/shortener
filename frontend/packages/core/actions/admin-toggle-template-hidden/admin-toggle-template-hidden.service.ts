import type { AxiosResponse } from 'axios';
import { api } from '../api';
import type { AdminToggleTemplateHiddenResponse } from './admin-toggle-template-hidden.types';

export async function toggleTemplateHidden(
  id: number
): Promise<AdminToggleTemplateHiddenResponse> {
  const response: AxiosResponse<AdminToggleTemplateHiddenResponse> =
    await api.post(`/api/admin/page_templates/${id}/toggle_hidden`);

  return response.data;
}
