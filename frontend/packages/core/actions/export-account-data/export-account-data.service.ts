import { api } from '../api';

export async function exportAccountData(currentPassword?: string): Promise<Blob> {
  const response = await api.post<Blob>(
    '/api/me/data_export',
    { current_password: currentPassword },
    { responseType: 'blob' }
  );
  return response.data;
}
