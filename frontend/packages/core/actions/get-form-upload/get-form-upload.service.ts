import { api } from '../api';

export async function getFormUpload(formId: number | string, token: string): Promise<Blob> {
  const response = await api.get<Blob>(
    `/api/me/forms/${formId}/uploads/${encodeURIComponent(token)}`,
    { responseType: 'blob' }
  );
  return response.data;
}
