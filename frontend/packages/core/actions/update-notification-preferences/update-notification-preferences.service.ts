import { AxiosError } from 'axios';
import { api } from '../api';
import type { GetNotificationPreferencesResponse } from '../get-notification-preferences/get-notification-preferences.types';
import type { UpdateNotificationPreferencesParams } from './update-notification-preferences.types';

export async function updateNotificationPreferences(
  params: UpdateNotificationPreferencesParams
): Promise<GetNotificationPreferencesResponse> {
  try {
    const response = await api.put<GetNotificationPreferencesResponse>(
      '/api/me/notification_preferences',
      params
    );
    return response.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      throw error.response?.data;
    }
    throw error;
  }
}
