import { api } from '../api';

export async function deletePushSubscription(id: number): Promise<void> {
  await api.delete(`/api/me/push_subscriptions/${id}`);
}
