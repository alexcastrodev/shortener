import { api } from '../api';

export async function getFormCover(formId: number | string): Promise<Blob> {
  const response = await api.get<Blob>(`/api/me/forms/${formId}/cover`, {
    responseType: 'blob',
  });
  return response.data;
}
