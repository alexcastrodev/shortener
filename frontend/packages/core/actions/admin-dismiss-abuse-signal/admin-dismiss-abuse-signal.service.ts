import { api } from '../api';

export async function dismissAbuseSignal(id: number): Promise<void> {
  await api.post(`/api/admin/abuse_signals/${id}/dismiss`);
}
