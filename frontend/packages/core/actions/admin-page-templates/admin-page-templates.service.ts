import type { AxiosResponse } from 'axios';
import { api } from '../api';
import type {
  AdminPageTemplatesResponse,
  AdminPageTemplatesStatus,
} from './admin-page-templates.types';

export async function getAdminPageTemplates(
  status: AdminPageTemplatesStatus
): Promise<AdminPageTemplatesResponse> {
  const response: AxiosResponse<AdminPageTemplatesResponse> = await api.get(
    '/api/admin/page_templates',
    { params: { status } }
  );

  return response.data;
}
