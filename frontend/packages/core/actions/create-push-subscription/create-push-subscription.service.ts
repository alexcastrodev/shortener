import { AxiosError } from 'axios';
import { api } from '../api';

export interface PushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export async function createPushSubscription(
  input: PushSubscriptionInput
): Promise<number> {
  try {
    const response = await api.post<{ push_subscription: { id: number } }>(
      '/api/me/push_subscriptions',
      input
    );
    return response.data.push_subscription.id;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw error.response?.data;
    }
    throw error;
  }
}
