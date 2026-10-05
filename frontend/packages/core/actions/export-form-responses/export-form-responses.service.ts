import { api } from '../api';

export async function exportFormResponses(formId: number | string, days?: number | 'all'): Promise<Blob> {
  const response = await api.get<Blob>(`/api/me/forms/${formId}/responses_export`, {
    params: { days: days === 'all' ? undefined : days },
    responseType: 'blob',
  });
  return response.data;
}
