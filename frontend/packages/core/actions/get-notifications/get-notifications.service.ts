import type { AxiosResponse } from 'axios';
import { api } from '../api';
import type { GetNotificationsResponse } from './get-notifications.types';

export async function getNotifications(): Promise<GetNotificationsResponse> {
  const response: AxiosResponse<GetNotificationsResponse> = await api.get(
    '/api/me/notifications'
  );

  return response.data;
}
