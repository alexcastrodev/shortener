import { useQuery } from '@tanstack/react-query';
import type { ResponseError } from '../../types/ResponseError';
import { getNotificationPreferences } from './get-notification-preferences.service';
import type { GetNotificationPreferencesResponse } from './get-notification-preferences.types';

export const getNotificationPreferencesKey = ['get-notification-preferences'];

export function useGetNotificationPreferences(enabled: boolean) {
  return useQuery<GetNotificationPreferencesResponse, ResponseError>({
    queryKey: getNotificationPreferencesKey,
    queryFn: getNotificationPreferences,
    enabled,
    retry: false,
  });
}
