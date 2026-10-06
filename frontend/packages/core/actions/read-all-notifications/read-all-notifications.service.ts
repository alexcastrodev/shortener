import { api } from '../api';

export async function readAllNotifications(): Promise<void> {
  await api.post('/api/me/notifications/read_all');
}
