import { api } from '../api';
import type { GetNotificationPreferencesResponse } from './get-notification-preferences.types';

export async function getNotificationPreferences(): Promise<GetNotificationPreferencesResponse> {
  const response = await api.get<GetNotificationPreferencesResponse>(
    '/api/me/notification_preferences'
  );
  return response.data;
}
