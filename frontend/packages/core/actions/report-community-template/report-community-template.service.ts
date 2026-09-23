import { AxiosError } from 'axios';
import { api } from '../api';
import type { ReportCommunityTemplateParams } from './report-community-template.types';

export async function reportCommunityTemplate({
  id,
  reason,
}: ReportCommunityTemplateParams): Promise<void> {
  try {
    await api.post(`/api/me/community_templates/${id}/report`, { reason });
  } catch (error) {
    if (error instanceof AxiosError) throw error.response?.data;
    throw error;
  }
}
