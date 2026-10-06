import { api } from '../api';

export async function exportAccountData(currentPassword?: string): Promise<void> {
  await api.post('/api/me/data_export', { current_password: currentPassword });
}
