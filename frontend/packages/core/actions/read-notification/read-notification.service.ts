import { api } from '../api';

export async function readNotification(id: number): Promise<void> {
  await api.post(`/api/me/notifications/${id}/read`);
}
